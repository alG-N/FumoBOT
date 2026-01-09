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
const { getUserBiomeData } = require('./BiomeService/BiomeDatabaseService');
const { getBiomeImage } = require('../../Configuration/biomeConfig');

async function getFarmStatusData(userId, username) {
    const now = Date.now();
    
    const [fragmentUses, farmingFumos, boosts, seasonalMults, activeSeasons, buildingLevels, upgradesRow, biomeData] = 
        await Promise.all([
            getFarmLimit(userId),
            getUserFarmingFumos(userId),
            getActiveBoosts(userId, now),
            getCurrentMultipliers(),
            getActiveSeasonsList(),
            getBuildingLevels(userId),
            get(`SELECT limitBreaks FROM userUpgrades WHERE userId = ?`, [userId]),
            getUserBiomeData(userId)
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
        },
        biome: biomeData
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
             AND (extra IS NULL OR json_extract(extra, '$.sigilDisabled') IS NULL OR json_extract(extra, '$.sigilDisabled') != 1)`,
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
        .replace(/\[🔮GLITCHED\]/g, '')
        .replace(/\[🌀VOID\]/g, '')
        .trim();
}

function getTrait(fumoName) {
    if (fumoName.includes('[🌟alG]')) return '🌟';
    if (fumoName.includes('[✨SHINY]')) return '✨';
    if (fumoName.includes('[🔮GLITCHED]')) return '🔮';
    if (fumoName.includes('[🌀VOID]')) return '🌀';
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
    const { username, farmingFumos, farmLimit, totalFarmingCount, fragmentUses, limitBreaks, boosts, seasons, biome } = farmData;

    const grouped = groupByRarity(farmingFumos, boosts);
    const { totalCoins, totalGems } = calculateTotals(grouped);
    
    // Get biome image
    const biomeImage = biome ? getBiomeImage(biome.biomeId) : null;
    const biomeInfo = biome?.biome;
    
    // Calculate progress bar for farm slots
    const slotProgress = Math.min(totalFarmingCount / farmLimit, 1);
    const slotBar = createProgressBar(slotProgress, 10);

    const embed = new EmbedBuilder()
        .setTitle(`🌾 ${username}'s Farm`)
        .setColor(biomeInfo?.color || Colors.Blurple);
    
    // Biome section
    if (biomeInfo) {
        embed.setDescription([
            `\`\`\`ansi`,
            `\u001b[1;36m📍 ${biomeInfo.name}\u001b[0m`,
            `\`\`\``,
            `> ${biomeInfo.description}`,
            ``,
            `**Biome Bonus:** 💰 \`${biomeInfo.multipliers.coins}x\` | 💎 \`${biomeInfo.multipliers.gems}x\``
        ].join('\n'));
        
        if (biomeImage) {
            embed.setImage(biomeImage);
        }
    }

    // Farm slots with progress bar
    embed.addFields({
        name: '📦 Farm Capacity',
        value: [
            `${slotBar} \`${totalFarmingCount}/${farmLimit}\``,
            `🔮 Fragments: ${fragmentUses} | ⚡ Limit Breaks: ${limitBreaks}`
        ].join('\n'),
        inline: false
    });

    // Compact earnings summary
    embed.addFields({
        name: '💵 Total Income (with boosts)',
        value: [
            `💰 \`${formatFarmingNumber(totalCoins)}\`/min`,
            `💎 \`${formatFarmingNumber(totalGems)}\`/min`
        ].join('  •  '),
        inline: false
    });

    // Group fumos by rarity in a more compact way
    const rarityGroups = [];
    for (const rarity of RARITY_PRIORITY) {
        if (!grouped[rarity]) continue;
        const { fumos, totalCoins: rarityCoins, totalGems: rarityGems } = grouped[rarity];
        
        // Format fumo names compactly: Arisu(✨) x5, Reimu(🌟) x2
        const fumoNames = fumos.slice(0, 5).map(f => {
            // Extract just the character name from baseName like "Arisu(TRANSCENDENT)"
            const charName = f.baseName.replace(/\(.*?\)/, '').trim();
            const traitDisplay = f.trait ? `(${f.trait})` : '';
            const qtyStr = f.quantity > 1 ? ` x${f.quantity}` : '';
            return `${charName}${traitDisplay}${qtyStr}`;
        });
        
        const moreCount = fumos.length > 5 ? ` +${fumos.length - 5} more` : '';
        
        rarityGroups.push({
            name: `${getRarityEmoji(rarity)} ${rarity}`,
            value: `\`${formatFarmingNumber(rarityCoins)}💰/${formatFarmingNumber(rarityGems)}💎\`\n${fumoNames.join(', ')}${moreCount}`,
            inline: true
        });
    }
    
    // Add rarity groups in pairs
    if (rarityGroups.length > 0) {
        embed.addFields(rarityGroups.slice(0, 6)); // Max 6 inline fields
    }

    // Active effects section
    const effects = [];
    
    if (seasons?.active && seasons.active !== 'No active seasonal events') {
        effects.push(`🌤️ **Season:** ${seasons.active}`);
    }

    const relevantBoosts = boosts?.activeBoosts?.filter(b => 
        ['coin', 'coins', 'gem', 'gems', 'income'].includes((b.type || '').toLowerCase())
    );

    if (relevantBoosts?.length > 0) {
        const boostText = relevantBoosts.slice(0, 3).map(b => 
            `${b.source} x${b.multiplier}`
        ).join(' | ');
        effects.push(`⚡ **Boosts:** ${boostText}`);
    }
    
    if (effects.length > 0) {
        embed.addFields({
            name: '✨ Active Effects',
            value: effects.join('\n'),
            inline: false
        });
    }

    embed.setFooter({ 
        text: '💡 Use the buttons below to manage your farm' 
    }).setTimestamp();

    return embed;
}

function createProgressBar(progress, length = 10) {
    const filled = Math.round(progress * length);
    const empty = length - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
}

// Rarity emojis - matches RARITY_PRIORITY casing
const RARITY_EMOJIS = {
    'Common': '⚪',
    'UNCOMMON': '🟢',
    'RARE': '🔵',
    'EPIC': '🟣',
    'OTHERWORLDLY': '🌌',
    'LEGENDARY': '🟠',
    'MYTHICAL': '🔴',
    'EXCLUSIVE': '💎',
    '???': '❓',
    'ASTRAL': '🌠',
    'CELESTIAL': '✨',
    'INFINITE': '♾️',
    'ETERNAL': '🪐',
    'TRANSCENDENT': '🌈'
};

function getRarityEmoji(rarity) {
    return RARITY_EMOJIS[rarity] || RARITY_EMOJIS[rarity?.toUpperCase()] || '⚪';
}

module.exports = {
    getFarmStatusData,
    createFarmStatusEmbed,
    getActiveBoosts
};