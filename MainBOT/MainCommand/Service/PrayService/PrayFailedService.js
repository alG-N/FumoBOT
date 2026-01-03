const { EmbedBuilder } = require('discord.js');
const { PRAY_FAILED_CONFIG } = require('../../Configuration/prayConfig');
const { formatNumber } = require('../../Ultility/formatting');
const { run, all, get, transaction } = require('../../Core/database');
const { checkSanaePrayImmunity, invalidateUserCaches } = require('./PrayDatabaseService');

/**
 * PrayFailedService - Handles the pray failed mechanic
 * 
 * Flow:
 * 1. User prays → Character selected
 * 2. BEFORE showing character, check if pray fails (10% base, scaled by rarity)
 * 3. If failed: Check Sanae immunity → If immune, proceed normally
 * 4. If not immune: 25% escape chance
 * 5. If caught (75%): Apply penalties (fumos, currency, items, tokens)
 */

/**
 * Check if pray should fail based on character rarity
 * @param {string} characterRarity - The rarity of the selected character
 * @returns {boolean} Whether the pray failed
 */
function shouldPrayFail(characterRarity) {
    const baseChance = PRAY_FAILED_CONFIG.baseFailChance;
    const modifier = PRAY_FAILED_CONFIG.rarityFailChanceModifiers[characterRarity] || 1.0;
    const finalChance = baseChance * modifier;
    
    return Math.random() < finalChance;
}

/**
 * Select a random fail entity based on weights
 * @returns {Object} Selected entity { name, emoji }
 */
function selectFailEntity() {
    const entities = PRAY_FAILED_CONFIG.failEntities;
    const totalWeight = entities.reduce((sum, e) => sum + e.weight, 0);
    let roll = Math.random() * totalWeight;
    
    for (const entity of entities) {
        roll -= entity.weight;
        if (roll <= 0) {
            return { name: entity.name, emoji: entity.emoji };
        }
    }
    
    return entities[0]; // Fallback
}

/**
 * Check if user escapes the penalty
 * @returns {boolean} Whether user escaped
 */
function checkEscape() {
    return Math.random() < PRAY_FAILED_CONFIG.escapeChance;
}

/**
 * Apply penalties to user when caught by fail entity
 * Uses transaction to ensure atomicity
 * @param {string} userId - User ID
 * @returns {Object} Summary of penalties applied
 */
async function applyPrayFailedPenalties(userId) {
    const penalties = PRAY_FAILED_CONFIG.penalties;
    const summary = {
        fumosLost: 0,
        coinsLost: 0,
        gemsLost: 0,
        itemsLost: 0,
        tokensLost: 0,
        details: []
    };
    
    try {
        // 1. Get user's current resources
        const userData = await get(
            `SELECT coins, gems, spiritTokens FROM userCoins WHERE userId = ?`,
            [userId],
            true
        );
        
        if (!userData) return summary;
        
        // Invalidate caches before modifications
        if (typeof invalidateUserCaches === 'function') {
            invalidateUserCaches(userId);
        }
        
        // 2. Calculate and deduct currency (15% of total)
        const coinsToLose = Math.floor((userData.coins || 0) * penalties.currencyLossPercent);
        const gemsToLose = Math.floor((userData.gems || 0) * penalties.currencyLossPercent);
        
        if (coinsToLose > 0 || gemsToLose > 0) {
            await run(
                `UPDATE userCoins SET coins = MAX(0, coins - ?), gems = MAX(0, gems - ?) WHERE userId = ?`,
                [coinsToLose, gemsToLose, userId]
            );
            summary.coinsLost = coinsToLose;
            summary.gemsLost = gemsToLose;
            summary.details.push(`💰 Lost ${formatNumber(coinsToLose)} coins`);
            summary.details.push(`💎 Lost ${formatNumber(gemsToLose)} gems`);
        }
        
        // 3. Deduct Fumo Tokens (25)
        const currentTokens = userData.spiritTokens || 0;
        const tokensToLose = Math.min(penalties.fumoTokenLoss, currentTokens);
        if (tokensToLose > 0) {
            await run(
                `UPDATE userCoins SET spiritTokens = MAX(0, spiritTokens - ?) WHERE userId = ?`,
                [tokensToLose, userId]
            );
            summary.tokensLost = tokensToLose;
            summary.details.push(`🪙 Lost ${tokensToLose} Fumo Tokens`);
        }
        
        // 4. Delete random fumos (15-450)
        const fumosToDelete = Math.floor(
            Math.random() * (penalties.fumoLoss.max - penalties.fumoLoss.min + 1)
        ) + penalties.fumoLoss.min;
        
        // Get fumos that can be deleted (those with fumoName set)
        const userFumos = await all(
            `SELECT id, fumoName, quantity FROM userInventory 
             WHERE userId = ? AND fumoName IS NOT NULL AND fumoName != '' AND quantity > 0
             ORDER BY RANDOM()`,
            [userId],
            true
        );
        
        let fumosDeleted = 0;
        for (const fumo of userFumos || []) {
            if (fumosDeleted >= fumosToDelete) break;
            
            const qty = fumo.quantity || 1;
            const toDelete = Math.min(qty, fumosToDelete - fumosDeleted);
            
            if (toDelete >= qty) {
                await run(`DELETE FROM userInventory WHERE id = ?`, [fumo.id]);
            } else {
                await run(
                    `UPDATE userInventory SET quantity = quantity - ? WHERE id = ?`,
                    [toDelete, fumo.id]
                );
            }
            
            fumosDeleted += toDelete;
        }
        
        summary.fumosLost = fumosDeleted;
        if (fumosDeleted > 0) {
            summary.details.push(`🎴 Lost ${fumosDeleted} fumos`);
        }
        
        // 5. Delete random items (350)
        const itemsToDelete = penalties.itemLoss;
        
        // Get items that can be deleted (those with itemName set, not fumos)
        const userItems = await all(
            `SELECT id, itemName, quantity FROM userInventory 
             WHERE userId = ? AND itemName IS NOT NULL AND itemName != '' 
             AND (fumoName IS NULL OR fumoName = '') AND quantity > 0
             ORDER BY RANDOM()`,
            [userId],
            true
        );
        
        let itemsDeleted = 0;
        for (const item of userItems || []) {
            if (itemsDeleted >= itemsToDelete) break;
            
            const qty = item.quantity || 1;
            const toDelete = Math.min(qty, itemsToDelete - itemsDeleted);
            
            if (toDelete >= qty) {
                await run(`DELETE FROM userInventory WHERE id = ?`, [item.id]);
            } else {
                await run(
                    `UPDATE userInventory SET quantity = quantity - ? WHERE id = ?`,
                    [toDelete, item.id]
                );
            }
            
            itemsDeleted += toDelete;
        }
        
        summary.itemsLost = itemsDeleted;
        if (itemsDeleted > 0) {
            summary.details.push(`📦 Lost ${itemsDeleted} items`);
        }
        
    } catch (error) {
        console.error('[PrayFailed] Error applying penalties:', error);
    }
    
    return summary;
}

/**
 * Handle the pray failed scenario
 * This should be called AFTER character selection but BEFORE showing the character
 * 
 * @param {string} userId - User ID
 * @param {Object} channel - Discord channel to send messages
 * @param {string} characterRarity - The rarity of the would-be character
 * @returns {Object} { failed: boolean, handled: boolean }
 *   - failed: true if pray failed (don't proceed with normal flow)
 *   - handled: true if we sent a message (for escaped/caught scenarios)
 */
async function handlePrayFailed(userId, channel, characterRarity) {
    // Step 1: Check if pray should fail
    if (!shouldPrayFail(characterRarity)) {
        return { failed: false, handled: false }; // Pray proceeds normally
    }
    
    // Step 2: Select the fail entity
    const entity = selectFailEntity();
    
    // Step 3: Check Sanae pray immunity
    let immunity = { active: false };
    try {
        immunity = await checkSanaePrayImmunity(userId);
    } catch (err) {
        console.error('[PrayFailed] Error checking immunity:', err);
    }
    
    if (immunity.active) {
        // Protected by Sanae blessing!
        const messages = PRAY_FAILED_CONFIG.messages.immuneBlocked;
        const message = messages[Math.floor(Math.random() * messages.length)]
            .replace('{entity}', entity.name);
        
        await channel.send({
            embeds: [new EmbedBuilder()
                .setTitle(`${entity.emoji} ${entity.name} Appeared!`)
                .setDescription(
                    `${message}\n\n` +
                    `✨ **Sanae's Blessing Protected You!** ✨\n` +
                    `Your pray continues normally...`
                )
                .setColor('#00FF00')
                .setFooter({ text: 'Pray Immunity saved you from disaster!' })
                .setTimestamp()]
        });
        
        return { failed: false, handled: true }; // Pray proceeds normally after message
    }
    
    // Step 4: Check escape chance (25%)
    if (checkEscape()) {
        const messages = PRAY_FAILED_CONFIG.messages.escaped;
        const message = messages[Math.floor(Math.random() * messages.length)]
            .replace('{entity}', entity.name);
        
        await channel.send({
            embeds: [new EmbedBuilder()
                .setTitle(`${entity.emoji} ${entity.name} Appeared!`)
                .setDescription(
                    `${message}\n\n` +
                    `🏃 **You got lucky and escaped!**\n` +
                    `But your prayer ritual was disrupted...`
                )
                .setColor('#FFA500')
                .setFooter({ text: 'Close call! Your resources are safe but the pray failed.' })
                .setTimestamp()]
        });
        
        return { failed: true, handled: true }; // Pray failed but no penalty
    }
    
    // Step 5: Apply penalties (75% chance to reach here)
    const penaltySummary = await applyPrayFailedPenalties(userId);
    
    const messages = PRAY_FAILED_CONFIG.messages.caught;
    const message = messages[Math.floor(Math.random() * messages.length)]
        .replace('{entity}', entity.name);
    
    const penaltyText = penaltySummary.details.length > 0 
        ? penaltySummary.details.join('\n') 
        : '*No resources to take...*';
    
    await channel.send({
        embeds: [new EmbedBuilder()
            .setTitle(`${entity.emoji} ${entity.name} Caught You!`)
            .setDescription(
                `${message}\n\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                `**💀 PENALTIES APPLIED:**\n` +
                `${penaltyText}\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                `*Your prayer was corrupted by malevolent forces...*\n` +
                `💡 **Tip:** Sanae's Pray Immunity blessing can protect you!`
            )
            .setColor('#FF0000')
            .setFooter({ text: `Would-be rarity: ${characterRarity} | Better luck next time...` })
            .setTimestamp()]
    });
    
    return { failed: true, handled: true }; // Pray failed with penalties
}

/**
 * Get fail chance for display purposes (in percentage)
 * @param {string} characterRarity - Character rarity
 * @returns {string} Fail chance as percentage string (e.g., "10.0")
 */
function getFailChancePercent(characterRarity) {
    const baseChance = PRAY_FAILED_CONFIG.baseFailChance;
    const modifier = PRAY_FAILED_CONFIG.rarityFailChanceModifiers[characterRarity] || 1.0;
    return (baseChance * modifier * 100).toFixed(1);
}

/**
 * Get all fail chances for display
 * @returns {Object} Map of rarity to fail chance percentage
 */
function getAllFailChances() {
    const result = {};
    for (const [rarity, modifier] of Object.entries(PRAY_FAILED_CONFIG.rarityFailChanceModifiers)) {
        result[rarity] = (PRAY_FAILED_CONFIG.baseFailChance * modifier * 100).toFixed(1);
    }
    return result;
}

module.exports = {
    shouldPrayFail,
    handlePrayFailed,
    applyPrayFailedPenalties,
    selectFailEntity,
    checkEscape,
    getFailChancePercent,
    getAllFailChances,
    PRAY_FAILED_CONFIG
};
