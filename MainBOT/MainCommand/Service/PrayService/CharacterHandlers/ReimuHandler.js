const { EmbedBuilder } = require('discord.js');
const { PRAY_CHARACTERS } = require('../../../Configuration/prayConfig');
const { formatNumber } = require('../../../Ultility/formatting');
const { incrementWeeklyShiny, incrementWeeklyAstral } = require('../../../Ultility/weekly');
const FumoPool = require('../../../Data/FumoPool');
const { run, get } = require('../../../Core/database');
const {
    getUserData,
    deductUserCurrency,
    updateReimuData,
    addSpiritTokens,
    incrementDailyPray
} = require('../PrayDatabaseService');

/**
 * Get S!gil Reimu luck multiplier (+500%)
 * Increases chances for alG and SHINY variants in Reimu gifts
 */
async function getSigilReimuLuckMultiplier(userId) {
    const now = Date.now();
    
    const sigilReimuLuck = await get(
        `SELECT multiplier FROM activeBoosts 
         WHERE userId = ? AND source = 'S!gil' AND type = 'reimuLuck'
         AND (expiresAt IS NULL OR expiresAt > ?)`,
        [userId, now]
    );
    
    if (sigilReimuLuck) {
        return sigilReimuLuck.multiplier; // x5.0 luck
    }
    
    return 1.0;
}

async function handleReimu(userId, channel, interactionUserId) {
    const config = PRAY_CHARACTERS.REIMU;
    const user = await getUserData(userId);

    if (!user) {
        await channel.send('❌ User data not found.');
        return;
    }

    const now = Date.now();
    const resetWindow = config.resetWindow;

    if (!user.reimuLastReset || now - user.reimuLastReset > resetWindow) {
        await updateReimuData(userId, { reimuUsageCount: 0, reimuLastReset: now });
        user.reimuUsageCount = 0;
    }

    if (user.reimuUsageCount >= 8) {
        await channel.send({
            embeds: [new EmbedBuilder()
                .setTitle("⏳ Prayer Cooldown")
                .setDescription("You have prayed to Reimu too many times today. Come back later.")
                .setColor(0xff5555)
                .setTimestamp()]
        });
        return;
    }

    if (user.reimuStatus === 1) {
        await handleGiftPhase(userId, channel, user, config, interactionUserId);
    } else {
        await handleDonationPhase(userId, channel, user, config);
    }
}

async function handleGiftPhase(userId, channel, user, config, interactionUserId) {
    const giftConfig = config.phases.gift;
    const pityCount = user.reimuPityCount || 0;
    
    // Get S!gil Reimu luck multiplier for RARITY chances (+500% = x5)
    const reimuLuckMult = await getSigilReimuLuckMultiplier(userId);

    let pickedRarity;

    if (pityCount >= 10) {
        pickedRarity = giftConfig.ultraRares[Math.floor(Math.random() * giftConfig.ultraRares.length)];
    } else {
        // Apply S!gil luck boost to rarity probabilities
        const baseProbabilities = giftConfig.rarities;
        let adjustedProbabilities;
        
        if (reimuLuckMult > 1) {
            // Boost higher rarities with the luck multiplier
            adjustedProbabilities = applyReimuLuckBoost(baseProbabilities, reimuLuckMult);
        } else {
            adjustedProbabilities = baseProbabilities;
        }
        
        // Then apply pity boost on top
        adjustedProbabilities = applyPityBoost(adjustedProbabilities, pityCount, giftConfig.pityBoost);
        pickedRarity = pickRarity(adjustedProbabilities);
    }

    const prayFumos = FumoPool.getForPray();
    const filteredFumos = prayFumos.filter(fumo => fumo.rarity === pickedRarity);

    if (filteredFumos.length === 0) {
        await channel.send('❌ No fumos available for that rarity!');
        return;
    }

    const fumo = filteredFumos[Math.floor(Math.random() * filteredFumos.length)];
    
    // Variant chances (SHINY/alG) - boosted by S!gil Reimu luck
    // Base rates: alG 10%, SHINY 35%
    // With S!gil luck boost: multiply chances (capped at reasonable values)
    const baseAlgChance = 0.1;
    const baseShinyChance = 0.35;
    
    // Apply Reimu luck multiplier to variant chances (capped)
    const algChance = Math.min(baseAlgChance * reimuLuckMult, 0.5); // Max 50% alG chance
    const shinyChance = Math.min(baseShinyChance * reimuLuckMult, 0.8); // Max 80% SHINY chance
    
    const isAlterGolden = Math.random() < algChance;
    const isShiny = !isAlterGolden && Math.random() < shinyChance;

    let fumoName = fumo.name;
    if (isAlterGolden) {
        fumoName += '[🌟alG]';
        await incrementWeeklyShiny(interactionUserId);
    } else if (isShiny) {
        fumoName += '[✨SHINY]';
        await incrementWeeklyShiny(interactionUserId);
    }

    if (giftConfig.ultraRares.includes(fumo.rarity)) {
        await incrementWeeklyAstral(interactionUserId);
    }

    await run(
        `INSERT INTO userInventory (userId, items, fumoName, rarity) VALUES (?, ?, ?, ?)`,
        [userId, fumo.rarity, fumoName, fumo.rarity]
    );

    const variantNote = isAlterGolden
        ? " It's a **divine, golden anomaly**—a truly miraculous find!"
        : isShiny
            ? " It sparkles with a magical glow—**a Shiny Fumo!**"
            : "";

    await channel.send({
        embeds: [new EmbedBuilder()
            .setTitle(`🎁 A Gift from Reimu! 🎁`)
            .setImage(fumo.picture)
            .setDescription(`She gives you a **${fumo.rarity}** Fumo: **${fumoName}**.${variantNote}`)
            .setColor('#0099ff')
            .setTimestamp()]
    });

    const tokensEarned = rollTokens();
    if (tokensEarned > 0) {
        await addSpiritTokens(userId, tokensEarned);
        await channel.send({
            embeds: [new EmbedBuilder()
                .setTitle(`✨ Fumo Token Blessing!`)
                .setDescription(`You received **${tokensEarned} Fumo Token${tokensEarned > 1 ? 's' : ''}**!`)
                .setColor('#a29bfe')
                .setTimestamp()]
        });
    }

    const resetPity = giftConfig.ultraRares.includes(fumo.rarity) ? 0 : pityCount + 1;

    await updateReimuData(userId, {
        reimuStatus: 0,
        reimuPityCount: resetPity,
        reimuUsageCount: (user.reimuUsageCount || 0) + 1
    });

    await incrementDailyPray(userId);
}

async function handleDonationPhase(userId, channel, user, config) {
    const donationConfig = config.phases.donation;
    const pity = user.reimuPityCount || 0;
    const penalty = Math.abs(user.reimuPenalty) || 0;

    let multiplier = 1;
    const pityMultipliers = donationConfig.pityMultipliers;
    
    if (pity >= pityMultipliers.high.min && pity <= pityMultipliers.high.max) {
        multiplier = pityMultipliers.high.multiplier;
    } else if (pity >= pityMultipliers.medium.min && pity <= pityMultipliers.medium.max) {
        multiplier = pityMultipliers.medium.multiplier;
    } else if (pity >= pityMultipliers.low.min && pity <= pityMultipliers.low.max) {
        multiplier = pityMultipliers.low.multiplier;
    }

    const requiredCoins = (30000 + penalty * 5000) * multiplier;
    const requiredGems = (2500 + penalty * 1000) * multiplier;

    if (user.coins >= requiredCoins && user.gems >= requiredGems) {
        await deductUserCurrency(userId, requiredCoins, requiredGems);
        await updateReimuData(userId, { reimuStatus: 1, reimuPenalty: 0 });

        await channel.send({
            embeds: [new EmbedBuilder()
                .setTitle('🙏 Reimu\'s Gratitude 🙏')
                .setDescription(
                    `You have earned her favor.\n\n` +
                    `Donated: **${formatNumber(requiredCoins)} coins** and **${formatNumber(requiredGems)} gems**\n` +
                    `Pity Multiplier: x${multiplier}`
                )
                .setColor('#0099ff')
                .setTimestamp()]
        });
    } else {
        await updateReimuData(userId, { reimuPenalty: penalty + 1 });

        const penaltyCoins = (penalty + 1) * 5000;
        const penaltyGems = (penalty + 1) * 1000;

        await channel.send({
            embeds: [new EmbedBuilder()
                .setTitle('😔 Reimu is Unimpressed 😔')
                .setDescription(
                    penalty === 0
                        ? 'You failed to donate enough. She gives you a cold look.'
                        : `Next time you must pay an extra ${formatNumber(penaltyCoins)} coins and ${formatNumber(penaltyGems)} gems.`
                )
                .setColor('#ff0000')
                .setTimestamp()]
        });
    }
}

/**
 * Apply S!gil Reimu luck boost to rarity probabilities
 * Boosts higher rarities significantly (x5 luck = much better rare chances)
 */
function applyReimuLuckBoost(probabilities, luckMultiplier) {
    if (luckMultiplier <= 1) return probabilities;
    
    const boosted = { ...probabilities };
    
    // Define rarity boost tiers - higher rarities get more boost
    const rarityBoosts = {
        'Common': 1,           // No boost
        'UNCOMMON': 1,         // No boost
        'RARE': 1.2,           // Small boost
        'EPIC': 1.5,           // Medium boost
        'OTHERWORLDLY': 2,     // Good boost
        'LEGENDARY': 2.5,      // Great boost
        'MYTHICAL': 3,         // Excellent boost
        '???': 4,              // Amazing boost
        'ASTRAL': 4.5,         // Incredible boost
        'CELESTIAL': 5,        // Maximum boost
        'INFINITE': 5,         // Maximum boost
        'ETERNAL': 5,          // Maximum boost
        'TRANSCENDENT': 5      // Maximum boost
    };
    
    // Apply luck multiplier scaled by rarity tier
    for (const [rarity, tierBoost] of Object.entries(rarityBoosts)) {
        if (boosted[rarity]) {
            // Scale the boost: higher tier rarities benefit more from luck
            const effectiveBoost = 1 + (luckMultiplier - 1) * tierBoost;
            boosted[rarity] *= effectiveBoost;
        }
    }
    
    return boosted;
}

function applyPityBoost(probabilities, pityCount, boostFactor) {
    if (pityCount >= 10) return probabilities;
    
    const boosted = { ...probabilities };
    const factor = Math.pow(boostFactor, pityCount * 1.5);
    const rareKeys = ['???', 'ASTRAL', 'CELESTIAL', 'INFINITE', 'ETERNAL', 'TRANSCENDENT'];
    
    rareKeys.forEach(r => {
        if (boosted[r]) boosted[r] *= factor;
    });
    
    return boosted;
}

function pickRarity(probabilities) {
    const entries = Object.entries(probabilities);
    const total = entries.reduce((sum, [, val]) => sum + val, 0);
    const rand = Math.random() * total;
    
    let acc = 0;
    for (const [rarity, chance] of entries) {
        acc += chance;
        if (rand <= acc) return rarity;
    }
    
    return entries[0][0];
}

function rollTokens() {
    const rng = Math.random();
    
    if (rng < 0.08) return 25;
    if (rng < 0.20) return 5;
    if (rng < 0.35) return 2;
    if (rng < 0.50) return 1;
    
    return 0;
}

module.exports = { handleReimu };