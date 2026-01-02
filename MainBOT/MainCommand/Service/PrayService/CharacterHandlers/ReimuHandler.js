const { EmbedBuilder } = require('discord.js');
const { PRAY_CHARACTERS, calculateScaledPrayCost } = require('../../../Configuration/prayConfig');
const { formatNumber } = require('../../../Ultility/formatting');
const { incrementWeeklyShiny, incrementWeeklyAstral } = require('../../../Ultility/weekly');
const FumoPool = require('../../../Data/FumoPool');
const { run, get } = require('../../../Core/database');
const {
    getUserData,
    deductUserCurrency,
    updateReimuData,
    addSpiritTokens,
    incrementDailyPray,
    getFumoTokens,
    deductFumoTokens
} = require('../PrayDatabaseService');

/**
 * Special Variant Configuration for Reimu gifts
 * VOID and GLITCHED can be obtained when special items are active
 */
const REIMU_VARIANT_CONFIG = {
    VOID: {
        baseChance: 0.001,      // 0.1% base (same as gacha)
        tag: '[🌀VOID]',
        sources: ['VoidCrystal']    // ONLY VoidCrystal provides VOID
    },
    GLITCHED: {
        baseChance: 1 / 50000,  // 0.002% base (same as gacha)
        tag: '[🔮GLITCHED]',
        sources: ['S!gil', 'CosmicCore']  // S!gil and CosmicCore provide GLITCHED
    }
};

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

/**
 * Get active special variant boosts for Reimu gifts
 * Checks for VoidCrystal, CosmicCore, and S!gil
 * @param {string} userId - User ID
 * @param {number} reimuLuckMult - Reimu luck multiplier to apply to variant chances
 * @returns {Object} Active variant info with chances
 */
async function getActiveReimuVariants(userId, reimuLuckMult = 1.0) {
    const now = Date.now();
    const variants = {
        void: null,
        glitched: null
    };
    
    // Check if S!gil is active (takes priority and has ALL variants)
    const sigilActive = await get(
        `SELECT * FROM activeBoosts 
         WHERE userId = ? AND source = 'S!gil' AND type = 'coin'
         AND (expiresAt IS NULL OR expiresAt > ?)`,
        [userId, now]
    );
    
    if (sigilActive) {
        // S!gil provides both GLITCHED and VOID
        const sigilGlitched = await get(
            `SELECT multiplier, extra FROM activeBoosts 
             WHERE userId = ? AND source = 'S!gil' AND type = 'glitchedTrait'
             AND (expiresAt IS NULL OR expiresAt > ?)`,
            [userId, now]
        );
        
        if (sigilGlitched) {
            try {
                const extra = JSON.parse(sigilGlitched.extra || '{}');
                // Apply Reimu luck to GLITCHED chance (capped at 0.01 = 1%)
                const baseChance = extra.chance || sigilGlitched.multiplier || REIMU_VARIANT_CONFIG.GLITCHED.baseChance;
                variants.glitched = {
                    chance: Math.min(baseChance * reimuLuckMult, 0.01),
                    tag: REIMU_VARIANT_CONFIG.GLITCHED.tag,
                    source: 'S!gil'
                };
            } catch {
                variants.glitched = {
                    chance: Math.min(REIMU_VARIANT_CONFIG.GLITCHED.baseChance * reimuLuckMult, 0.01),
                    tag: REIMU_VARIANT_CONFIG.GLITCHED.tag,
                    source: 'S!gil'
                };
            }
        }
        
        // S!gil does NOT grant VOID - only GLITCHED
        // VOID requires VoidCrystal to be active
        
        return variants;
    }
    
    // Check CosmicCore for GLITCHED (only when S!gil not active)
    const cosmicCore = await get(
        `SELECT multiplier, extra FROM activeBoosts 
         WHERE userId = ? AND source = 'CosmicCore' AND type = 'glitchedTrait'
         AND expiresAt > ?`,
        [userId, now]
    );
    
    if (cosmicCore) {
        try {
            const extra = JSON.parse(cosmicCore.extra || '{}');
            if (!extra.sigilDisabled) {
                const baseChance = extra.chance || cosmicCore.multiplier || REIMU_VARIANT_CONFIG.GLITCHED.baseChance;
                variants.glitched = {
                    chance: Math.min(baseChance * reimuLuckMult, 0.01),
                    tag: REIMU_VARIANT_CONFIG.GLITCHED.tag,
                    source: 'CosmicCore'
                };
            }
        } catch {
            variants.glitched = {
                chance: Math.min(REIMU_VARIANT_CONFIG.GLITCHED.baseChance * reimuLuckMult, 0.01),
                tag: REIMU_VARIANT_CONFIG.GLITCHED.tag,
                source: 'CosmicCore'
            };
        }
        
        // CosmicCore does NOT grant VOID - only GLITCHED
        // VOID requires VoidCrystal to be active
    }
    
    // Check VoidCrystal for VOID variant (independent of CosmicCore)
    const voidCrystal = await get(
        `SELECT multiplier, extra FROM activeBoosts 
         WHERE userId = ? AND source = 'VoidCrystal' AND type = 'voidTrait'
         AND expiresAt > ?`,
        [userId, now]
    );
    
    if (voidCrystal) {
        try {
            const extra = JSON.parse(voidCrystal.extra || '{}');
            if (!extra.sigilDisabled) {
                const voidChance = extra.chance || voidCrystal.multiplier || REIMU_VARIANT_CONFIG.VOID.baseChance;
                const adjustedChance = Math.min(voidChance * reimuLuckMult, 0.05);
                // Use the higher chance between VoidCrystal and CosmicCore
                if (!variants.void || adjustedChance > variants.void.chance) {
                    variants.void = {
                        chance: adjustedChance,
                        tag: REIMU_VARIANT_CONFIG.VOID.tag,
                        source: 'VoidCrystal'
                    };
                }
            }
        } catch {
            if (!variants.void) {
                variants.void = {
                    chance: Math.min(REIMU_VARIANT_CONFIG.VOID.baseChance * reimuLuckMult, 0.05),
                    tag: REIMU_VARIANT_CONFIG.VOID.tag,
                    source: 'VoidCrystal'
                };
            }
        }
    }
    
    return variants;
}

/**
 * Roll for special variants (GLITCHED or VOID) for Reimu gifts
 * @param {Object} variants - Active variant info from getActiveReimuVariants
 * @returns {Object|null} Rolled special variant or null
 */
function rollReimuSpecialVariant(variants) {
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
    
    // Roll for base variants (SHINY/alG)
    const isAlterGolden = Math.random() < algChance;
    const isShiny = !isAlterGolden && Math.random() < shinyChance;
    
    // Get and roll for special variants (VOID/GLITCHED) - affected by Reimu luck too!
    const activeVariants = await getActiveReimuVariants(userId, reimuLuckMult);
    const specialVariant = rollReimuSpecialVariant(activeVariants);

    // Build fumo name with variants
    // Order: FumoName(RARITY)[BASE_VARIANT][SPECIAL_VARIANT]
    let fumoName = fumo.name;
    if (isAlterGolden) {
        fumoName += '[🌟alG]';
        await incrementWeeklyShiny(interactionUserId);
    } else if (isShiny) {
        fumoName += '[✨SHINY]';
        await incrementWeeklyShiny(interactionUserId);
    }
    
    // Add special variant (VOID or GLITCHED)
    if (specialVariant) {
        fumoName += specialVariant.tag;
    }

    if (giftConfig.ultraRares.includes(fumo.rarity)) {
        await incrementWeeklyAstral(interactionUserId);
    }

    await run(
        `INSERT INTO userInventory (userId, items, fumoName, rarity) VALUES (?, ?, ?, ?)`,
        [userId, fumo.rarity, fumoName, fumo.rarity]
    );

    // Build variant description
    let variantNote = '';
    if (isAlterGolden && specialVariant) {
        variantNote = ` It's a **divine, golden anomaly** blessed by the ${specialVariant.type === 'GLITCHED' ? '🔮 **GLITCHED**' : '🌀 **VOID**'}—an impossibly rare find!`;
    } else if (isShiny && specialVariant) {
        variantNote = ` It sparkles with ${specialVariant.type === 'GLITCHED' ? '🔮 **glitched energy**' : '🌀 **void energy**'}—a magical and mysterious fumo!`;
    } else if (isAlterGolden) {
        variantNote = " It's a **divine, golden anomaly**—a truly miraculous find!";
    } else if (isShiny) {
        variantNote = " It sparkles with a magical glow—**a Shiny Fumo!**";
    } else if (specialVariant) {
        variantNote = specialVariant.type === 'GLITCHED' 
            ? " It radiates 🔮 **unstable glitched energy**—reality bends around it!"
            : " It emanates 🌀 **dark void energy**—consumed by the abyss!";
    }

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

    // Calculate scaled cost based on user's total wealth
    const scaledCost = calculateScaledPrayCost(config, user.coins || 0, user.gems || 0);
    
    // Apply pity multiplier and penalty to scaled cost
    const baseCoinCost = scaledCost.coins + (penalty * 5000);
    const baseGemCost = scaledCost.gems + (penalty * 1000);
    
    const requiredCoins = Math.floor(baseCoinCost * multiplier);
    const requiredGems = Math.floor(baseGemCost * multiplier);
    const requiredTokens = scaledCost.fumoTokens || 0;

    // Check fumo tokens if required (for MYTHICAL+ characters)
    if (requiredTokens > 0) {
        const userTokens = await getFumoTokens(userId);
        if (userTokens < requiredTokens) {
            await channel.send({
                embeds: [new EmbedBuilder()
                    .setTitle('❌ Insufficient Fumo Tokens')
                    .setDescription(`Reimu requires **${requiredTokens} Fumo Tokens** for this prayer.\nYou only have **${userTokens}** Fumo Tokens.`)
                    .setColor(0xff5555)
                    .setTimestamp()]
            });
            return;
        }
    }

    if (user.coins >= requiredCoins && user.gems >= requiredGems) {
        await deductUserCurrency(userId, requiredCoins, requiredGems);
        
        // Deduct fumo tokens if required
        if (requiredTokens > 0) {
            await deductFumoTokens(userId, requiredTokens);
        }
        
        await updateReimuData(userId, { reimuStatus: 1, reimuPenalty: 0 });

        // Build cost breakdown message
        let costBreakdown = `Donated: **${formatNumber(requiredCoins)} coins** and **${formatNumber(requiredGems)} gems**`;
        if (requiredTokens > 0) {
            costBreakdown += ` + **${requiredTokens} Fumo Tokens**`;
        }
        costBreakdown += `\nPity Multiplier: x${multiplier}`;
        
        if (scaledCost.breakdown) {
            costBreakdown += `\n\n📊 **Cost Breakdown:**`;
            costBreakdown += `\n├ Base: ${formatNumber(scaledCost.breakdown.baseCoins)} coins + ${formatNumber(scaledCost.breakdown.baseGems)} gems`;
            if (scaledCost.breakdown.percentCoins > 0 || scaledCost.breakdown.percentGems > 0) {
                costBreakdown += `\n├ Wealth Tax (${scaledCost.breakdown.coinPercent}%): +${formatNumber(scaledCost.breakdown.percentCoins)} coins`;
                costBreakdown += `\n└ Wealth Tax (${scaledCost.breakdown.gemPercent}%): +${formatNumber(scaledCost.breakdown.percentGems)} gems`;
            }
        }

        await channel.send({
            embeds: [new EmbedBuilder()
                .setTitle('🙏 Reimu\'s Gratitude 🙏')
                .setDescription(
                    `You have earned her favor.\n\n${costBreakdown}`
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
                        ? `You failed to donate enough. She gives you a cold look.\n\nRequired: **${formatNumber(requiredCoins)} coins** and **${formatNumber(requiredGems)} gems**`
                        : `Next time you must pay an extra ${formatNumber(penaltyCoins)} coins and ${formatNumber(penaltyGems)} gems.\n\nRequired: **${formatNumber(requiredCoins)} coins** and **${formatNumber(requiredGems)} gems**`
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