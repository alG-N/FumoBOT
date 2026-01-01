const { getFarmLimit, getUserFarmingFumos } = require('./FarmingDatabaseService');
const { calculateFarmLimit } = require('./FarmingCalculationService');
const { getCurrentMultipliers, getActiveSeasonsList } = require('./SeasonService/SeasonManagerService');
const { getBuildingLevels } = require('./BuildingService/BuildingDatabaseService');
const { calculateBuildingMultiplier } = require('../../Configuration/buildingConfig');
const { all, get } = require('../../Core/database');
const { EmbedBuilder, Colors } = require('discord.js');
const { formatNumber } = require('../../Ultility/formatting');
const { RARITY_PRIORITY } = require('../../Configuration/rarity');
const { getRarityFromName } = require('./FarmingCalculationService');

async function getFarmStatusData(userId, username) {
    const now = Date.now();
    
    const [fragmentUses, farmingFumos, boosts, seasonalMults, activeSeasons, buildingLevels, upgradesRow] = 
        await Promise.all([
            getFarmLimit(userId),
            getUserFarmingFumos(userId),
            getActiveBoosts(userId, now),
            getCurrentMultipliers(),
            getActiveSeasonsList(),
            getBuildingLevels(userId),
            get(`SELECT limitBreaks FROM userUpgrades WHERE userId = ?`, [userId])
        ]);

    const { coinMultiplier, gemMultiplier } = calculateMultipliers(boosts, seasonalMults, buildingLevels);
    const limitBreaks = upgradesRow?.limitBreaks || 0;
    const farmLimit = calculateFarmLimit(fragmentUses) + limitBreaks;
    
    const totalFarmingCount = farmingFumos.reduce((sum, f) => sum + (f.quantity || 1), 0);

    return {
        username,
        farmingFumos,
        farmLimit,
        totalFarmingCount,
        fragmentUses,
        limitBreaks,
        hasFumos: farmingFumos.length > 0,
        boosts: {
            coinMultiplier,
            gemMultiplier,
            activeBoosts: boosts
        },
        seasons: {
            active: activeSeasons,
            multipliers: seasonalMults
        }
    };
}

/**
 * Check if S!gil is currently active for a user
 */
async function isSigilActive(userId, now) {
    const sigil = await get(
        `SELECT * FROM activeBoosts 
         WHERE userId = ? AND source = 'S!gil' AND type = 'coin'
         AND (expiresAt IS NULL OR expiresAt > ?)`,
        [userId, now]
    );
    return !!sigil;
}

async function getActiveBoosts(userId, now) {
    // Check if S!gil is active
    const sigilActive = await isSigilActive(userId, now);
    
    if (sigilActive) {
        // Only return S!gil boosts when S!gil is active
        return await all(
            `SELECT type, multiplier, source, expiresAt FROM activeBoosts 
             WHERE userId = ? AND source = 'S!gil' AND (expiresAt IS NULL OR expiresAt > ?)`,
            [userId, now]
        );
    } else {
        // Return all non-sigilDisabled boosts
        return await all(
            `SELECT type, multiplier, source, expiresAt FROM activeBoosts 
             WHERE userId = ? AND (expiresAt IS NULL OR expiresAt > ?)
             AND (extra IS NULL OR json_extract(extra, '$.sigilDisabled') IS NOT true)`,
            [userId, now]
        );
    }
}

function calculateMultipliers(boosts, seasonalMults, buildingLevels) {
    let coinMultiplier = 1;
    let gemMultiplier = 1;

    boosts.forEach(b => {
        const type = (b.type || '').toLowerCase();
        const mult = b.multiplier || 1;
        if (['coin', 'income'].includes(type)) coinMultiplier *= mult;
        if (['gem', 'gems', 'income'].includes(type)) gemMultiplier *= mult;
    });

    const coinBuildingBoost = calculateBuildingMultiplier('COIN_BOOST', buildingLevels.COIN_BOOST);
    const gemBuildingBoost = calculateBuildingMultiplier('GEM_BOOST', buildingLevels.GEM_BOOST);

    return {
        coinMultiplier: coinMultiplier * coinBuildingBoost * seasonalMults.coinMultiplier,
        gemMultiplier: gemMultiplier * gemBuildingBoost * seasonalMults.gemMultiplier
    };
}

function getBaseFumoName(fumoName) {
    return fumoName
        .replace(/\[✨SHINY\]/g, '')
        .replace(/\[🌟alG\]/g, '')
        .trim();
}

function getTrait(fumoName) {
    if (fumoName.includes('[🌟alG]')) return '🌟alG';
    if (fumoName.includes('[✨SHINY]')) return '✨SHINY';
    return null;
}

function groupByRarity(farmingFumos, boosts) {
    const grouped = {};
    
    const fumoGroups = {};
    
    farmingFumos.forEach(fumo => {
        const baseName = getBaseFumoName(fumo.fumoName);
        const trait = getTrait(fumo.fumoName);
        const rarity = getRarityFromName(fumo.fumoName);
        
        const key = `${baseName}_${trait || 'base'}`;
        
        if (!fumoGroups[key]) {
            fumoGroups[key] = {
                baseName,
                trait,
                rarity,
                quantity: 0,
                coinsPerMin: fumo.coinsPerMin,
                gemsPerMin: fumo.gemsPerMin
            };
        }
        
        fumoGroups[key].quantity += (fumo.quantity || 1);
    });
        
    Object.values(fumoGroups).forEach(fumo => {
        if (!grouped[fumo.rarity]) {
            grouped[fumo.rarity] = { fumos: [], totalCoins: 0, totalGems: 0 };
        }
        
        const coinsWithBoost = Math.floor(fumo.coinsPerMin * fumo.quantity * boosts.coinMultiplier);
        const gemsWithBoost = Math.floor(fumo.gemsPerMin * fumo.quantity * boosts.gemMultiplier);
        
        grouped[fumo.rarity].fumos.push({
            baseName: fumo.baseName,
            trait: fumo.trait,
            quantity: fumo.quantity
        });
        
        grouped[fumo.rarity].totalCoins += coinsWithBoost;
        grouped[fumo.rarity].totalGems += gemsWithBoost;
        
    });
    
    return grouped;
}

function calculateTotals(grouped) {
    let totalCoins = 0, totalGems = 0;
    Object.values(grouped).forEach(g => {
        totalCoins += g.totalCoins;
        totalGems += g.totalGems;
    });
    return { totalCoins, totalGems };
}

function formatFumoList(fumos) {
    return fumos.map(f => {
        const traitStr = f.trait ? ` [${f.trait}]` : '';
        const baseName = f.baseName.replace(/\(.*?\)/, '');
        return f.quantity > 1 ? `${baseName}${traitStr} (x${f.quantity})` : `${baseName}${traitStr}`;
    }).join(', ');
}

function formatFarmingNumber(num) {
    const units = [
        { value: 1e33, symbol: 'Dc' },
        { value: 1e30, symbol: 'No' },
        { value: 1e27, symbol: 'Oc' },
        { value: 1e24, symbol: 'Sp' }, 
        { value: 1e21, symbol: 'Sx' }, 
        { value: 1e18, symbol: 'Qi' },
        { value: 1e15, symbol: 'Qa' }, 
        { value: 1e12, symbol: 'T'  },
        { value: 1e9,  symbol: 'B'  },
        { value: 1e6,  symbol: 'M'  },
        { value: 1e3,  symbol: 'K'  } 
    ];

    for (const u of units) {
        if (num >= u.value) {
            return (num / u.value).toFixed(2) + u.symbol;
        }
    }

    return num.toString();
}

function createFarmStatusEmbed(farmData) {
    const { username, farmingFumos, farmLimit, totalFarmingCount, fragmentUses, limitBreaks, boosts, seasons } = farmData;

    const grouped = groupByRarity(farmingFumos, boosts);
    const { totalCoins, totalGems } = calculateTotals(grouped);

    const embed = new EmbedBuilder()
        .setTitle('🌾 Fumo Farming Status')
        .setColor(Colors.Blurple)
        .setDescription(`🛠️ Your Fumos are working hard. Let's check how much loot they're bringing!`)
        .setImage('https://tse4.mm.bing.net/th/id/OIP.uPn1KR9q8AKKhhJVCr1C4QHaDz?rs=1&pid=ImgDetMain&o=7&rm=3');

    for (const rarity of RARITY_PRIORITY) {
        if (!grouped[rarity]) continue;
        const { fumos, totalCoins: rarityCoins, totalGems: rarityGems } = grouped[rarity];
        
        embed.addFields({
            name: `🔹 ${rarity}: ${formatFarmingNumber(rarityCoins)} coins/min, ${formatFarmingNumber(rarityGems)} gems/min`,
            value: formatFumoList(fumos) || 'None'
        });
    }

    embed.addFields(
        {
            name: '💰 Total Earnings (with all boosts)',
            value: `${formatFarmingNumber(totalCoins)} coins/min | ${formatFarmingNumber(totalGems)} gems/min`,
            inline: true
        },
        {
            name: '📦 Max Farming Slots',
            value: `${totalFarmingCount} / ${farmLimit}`,
            inline: true
        },
        {
            name: '🔮 Fragment of 1800s',
            value: `${fragmentUses} used`,
            inline: true
        }
    );

    if (limitBreaks > 0) {
        embed.addFields({
            name: '⚡ Limit Breaks',
            value: `Active: **${limitBreaks}** (+${limitBreaks} slots)`,
            inline: true
        });
    }

    if (seasons?.active && seasons.active !== 'No active seasonal events') {
        embed.addFields({
            name: '🌤️ Active Seasonal Events',
            value: seasons.active
        });
    }

    const relevantBoosts = boosts?.activeBoosts?.filter(b => 
        ['coin', 'coins', 'gem', 'gems', 'income'].includes((b.type || '').toLowerCase())
    );

    if (relevantBoosts?.length > 0) {
        embed.addFields({
            name: '⚡ Active Personal Boosts',
            value: relevantBoosts.map(b =>
                `• **${b.type}** x${b.multiplier} from [${b.source}]${b.expiresAt ? ` (expires <t:${Math.floor(b.expiresAt / 1000)}:R>)` : ''}`
            ).join('\n')
        });
    }

    embed.addFields({
        name: '📋 Notes:',
        value: 'Use `.endfarm` to stop farming specific Fumos.\nCheck `.farminfo` for rarity stats.'
    });

    return embed;
}

module.exports = {
    getFarmStatusData,
    createFarmStatusEmbed
};