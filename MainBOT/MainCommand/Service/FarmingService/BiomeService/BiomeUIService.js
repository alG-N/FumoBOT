const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { 
    getAllBiomes, 
    getAvailableBiomes, 
    getLockedBiomes, 
    getBiome,
    formatBiomeInfo,
    getBiomeRequirementText,
    BIOME_IMAGES,
    getBiomeImage,
    calculateUnlockCost,
    canAffordBiome
} = require('../../../Configuration/biomeConfig');
const { getUserBiomeData, setUserBiome, canChangeBiome, hasBiomeUnlocked, getUnlockedBiomes, unlockBiome } = require('./BiomeDatabaseService');
const { buildSecureCustomId, checkButtonOwnership } = require('../../../Middleware/buttonOwnership');
const { get, run } = require('../../../Core/database');
const { formatNumber } = require('../../../Ultility/formatting');

/**
 * Get user's currency
 */
async function getUserCurrency(userId) {
    const row = await get(`SELECT coins, gems FROM userCoins WHERE userId = ?`, [userId]);
    return { coins: row?.coins || 0, gems: row?.gems || 0 };
}

/**
 * Create biome selection embed with modern UI
 * @param {string} userId 
 * @param {number} level 
 * @param {number} rebirthLevel 
 * @returns {Promise<{embed: EmbedBuilder, components: ActionRowBuilder[]}>}
 */
async function createBiomeSelectEmbed(userId, level, rebirthLevel = 0) {
    const biomeData = await getUserBiomeData(userId);
    const availableBiomes = getAvailableBiomes(level, rebirthLevel);
    const lockedBiomes = getLockedBiomes(level, rebirthLevel);
    const unlockedBiomes = await getUnlockedBiomes(userId);
    const { coins, gems } = await getUserCurrency(userId);
    
    const embed = new EmbedBuilder()
        .setTitle('🌍 Biome Explorer')
        .setColor(biomeData.biome.color || 0x7CFC00)
        .setThumbnail(getBiomeImage(biomeData.biomeId))
        .setDescription([
            `\`\`\`fix`,
            `📍 Current Location`,
            `\`\`\``,
            `${biomeData.biome.emoji} **${biomeData.biome.name}**`,
            `> ${biomeData.biome.description}`,
            ``,
            `**💰** \`${biomeData.biome.multipliers.coins}x\` Coins  |  **💎** \`${biomeData.biome.multipliers.gems}x\` Gems`,
        ].join('\n'));
    
    // Add cooldown info
    if (!biomeData.canChange) {
        const hours = Math.ceil(biomeData.remainingMs / (60 * 60 * 1000));
        embed.addFields({
            name: '⏰ Travel Cooldown',
            value: `> You can travel again in **${hours}h**`,
            inline: false
        });
    }
    
    // Add available biomes with unlock status
    if (availableBiomes.length > 0) {
        const availableText = availableBiomes.map(b => {
            const isUnlocked = unlockedBiomes.includes(b.id) || b.id === 'GRASSLAND';
            const isCurrent = b.id === biomeData.biomeId;
            const costInfo = b.unlockCost ? calculateUnlockCost(b, coins, gems) : null;
            
            let status = '';
            if (isCurrent) {
                status = '📍';
            } else if (isUnlocked) {
                status = '✅';
            } else if (costInfo) {
                const affordable = canAffordBiome(b, coins, gems).canAfford;
                status = affordable ? '💰' : '🔒';
            }
            
            let unlockText = '';
            if (!isUnlocked && costInfo && !isCurrent) {
                unlockText = ` *(${costInfo.display})*`;
            }
            
            return `${status} ${b.emoji} **${b.name}** \`${b.multipliers.coins}x/${b.multipliers.gems}x\`${unlockText}`;
        }).join('\n');
        
        embed.addFields({
            name: `🗺️ Available Destinations (${availableBiomes.length})`,
            value: availableText || 'None',
            inline: false
        });
    }
    
    // Add locked biomes preview
    if (lockedBiomes.length > 0) {
        const lockedText = lockedBiomes
            .slice(0, 4)
            .map(b => `⛔ ${b.emoji} ~~${b.name}~~ *${getBiomeRequirementText(b)}*`)
            .join('\n');
        
        embed.addFields({
            name: `🔐 Locked Regions (${lockedBiomes.length})`,
            value: lockedText + (lockedBiomes.length > 4 ? `\n> *+${lockedBiomes.length - 4} more to discover...*` : ''),
            inline: false
        });
    }
    
    embed.addFields({
        name: '💵 Your Wallet',
        value: `💰 ${formatNumber(coins)} Coins  |  💎 ${formatNumber(gems)} Gems`,
        inline: false
    });
    
    // Create select menu for available biomes
    const components = [];
    
    if (availableBiomes.length > 1) {
        const selectOptions = availableBiomes.map(b => {
            const isUnlocked = unlockedBiomes.includes(b.id) || b.id === 'GRASSLAND';
            const costInfo = b.unlockCost ? calculateUnlockCost(b, coins, gems) : null;
            
            let description = `${b.multipliers.coins}x coins, ${b.multipliers.gems}x gems`;
            if (!isUnlocked && costInfo) {
                description = `🔓 Unlock: ${costInfo.display}`;
            }
            
            return {
                label: isUnlocked ? b.name : `🔓 ${b.name}`,
                description: description,
                value: b.id,
                emoji: b.emoji,
                default: b.id === biomeData.biomeId
            };
        });
        
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`biome_select_${userId}`)
            .setPlaceholder('🧭 Choose your destination...')
            .addOptions(selectOptions);
        
        components.push(new ActionRowBuilder().addComponents(selectMenu));
    }
    
    // Add buttons
    const buttonRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`biome_info_${userId}`)
            .setLabel('View Details')
            .setEmoji('📋')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`biome_refresh_${userId}`)
            .setLabel('Refresh')
            .setEmoji('🔄')
            .setStyle(ButtonStyle.Secondary)
    );
    
    components.push(buttonRow);
    
    return { embed, components };
}

/**
 * Create detailed biome info embed
 * @param {string} biomeId 
 * @returns {EmbedBuilder}
 */
function createBiomeDetailEmbed(biomeId) {
    const biome = getBiome(biomeId);
    
    if (!biome) {
        return new EmbedBuilder()
            .setTitle('❌ Biome Not Found')
            .setColor(0xFF0000)
            .setDescription('This biome does not exist.');
    }
    
    const embed = new EmbedBuilder()
        .setTitle(`${biome.emoji} ${biome.name}`)
        .setColor(biome.color)
        .setDescription(biome.description);
    
    // Multipliers
    embed.addFields({
        name: '📊 Base Multipliers',
        value: `💰 Coins: **${biome.multipliers.coins}x**\n💎 Gems: **${biome.multipliers.gems}x**`,
        inline: true
    });
    
    // Requirements
    embed.addFields({
        name: '📋 Requirements',
        value: getBiomeRequirementText(biome),
        inline: true
    });
    
    // Bonuses
    const bonuses = [];
    if (biome.bonuses.shinyBonus) bonuses.push(`✨ Shiny Fumos: +${biome.bonuses.shinyBonus}%`);
    if (biome.bonuses.alGBonus) bonuses.push(`🌟 alG Fumos: +${biome.bonuses.alGBonus}%`);
    if (biome.bonuses.commonBonus) bonuses.push(`⚪ Common Fumos: +${biome.bonuses.commonBonus}%`);
    if (biome.bonuses.voidBonus) bonuses.push(`🌀 Void Fumos: +${biome.bonuses.voidBonus}%`);
    if (biome.bonuses.glitchedBonus) bonuses.push(`🔮 Glitched Fumos: +${biome.bonuses.glitchedBonus}%`);
    if (biome.bonuses.allRarityBonus) bonuses.push(`⭐ All Fumos: +${biome.bonuses.allRarityBonus}%`);
    
    if (bonuses.length > 0) {
        embed.addFields({
            name: '🎁 Special Bonuses',
            value: bonuses.join('\n'),
            inline: false
        });
    }
    
    // Weather synergy
    if (biome.bonuses.weatherSynergy) {
        embed.addFields({
            name: '⛅ Weather Synergy',
            value: `Extra +50% during **${biome.bonuses.weatherSynergy}** weather!`,
            inline: false
        });
    }
    
    return embed;
}

/**
 * Create biome change success embed
 * @param {Object} newBiome 
 * @param {Object} oldBiome 
 * @returns {EmbedBuilder}
 */
function createBiomeChangeEmbed(newBiome, oldBiome) {
    return new EmbedBuilder()
        .setTitle('🌍 Biome Changed!')
        .setColor(newBiome.color)
        .setDescription(
            `You have moved from **${oldBiome.emoji} ${oldBiome.name}** to **${newBiome.emoji} ${newBiome.name}**!\n\n` +
            `> ${newBiome.description}`
        )
        .addFields(
            {
                name: 'Old Multipliers',
                value: `💰 ${oldBiome.multipliers.coins}x | 💎 ${oldBiome.multipliers.gems}x`,
                inline: true
            },
            {
                name: 'New Multipliers',
                value: `💰 ${newBiome.multipliers.coins}x | 💎 ${newBiome.multipliers.gems}x`,
                inline: true
            }
        )
        .setFooter({ text: 'You can change biome again in 24 hours' });
}

/**
 * Create compact biome info for farm status
 * @param {string} userId 
 * @returns {Promise<string>}
 */
async function getBiomeStatusText(userId) {
    const biomeData = await getUserBiomeData(userId);
    return `${biomeData.biome.emoji} ${biomeData.biome.name} (${biomeData.biome.multipliers.coins}x/${biomeData.biome.multipliers.gems}x)`;
}

/**
 * Handle biome change from select menu
 * @param {Interaction} interaction 
 * @param {string} userId 
 * @param {Object} message - Original message for refreshing
 * @param {number} userLevel
 * @param {number} userRebirth
 */
async function handleBiomeChange(interaction, userId, message, userLevel, userRebirth) {
    if (!interaction.isStringSelectMenu()) {
        return;
    }
    
    const selectedBiomeId = interaction.values[0];
    
    try {
        // Get old biome for comparison
        const oldBiomeData = await getUserBiomeData(userId);
        const oldBiome = oldBiomeData.biome;
        
        // Check if selecting same biome
        if (oldBiomeData.biomeId === selectedBiomeId) {
            return await interaction.reply({
                content: '❌ You are already in this biome!',
                ephemeral: true
            });
        }
        
        // Get new biome config
        const newBiome = getBiome(selectedBiomeId);
        if (!newBiome) {
            return await interaction.reply({
                content: '❌ Invalid biome selected.',
                ephemeral: true
            });
        }
        
        // Check if biome is unlocked
        const isUnlocked = await hasBiomeUnlocked(userId, selectedBiomeId);
        
        if (!isUnlocked && newBiome.unlockCost) {
            // Show purchase confirmation
            const { coins, gems } = await getUserCurrency(userId);
            const cost = calculateUnlockCost(newBiome, coins, gems);
            const { canAfford } = canAffordBiome(newBiome, coins, gems);
            
            if (!canAfford) {
                return await interaction.reply({
                    embeds: [new EmbedBuilder()
                        .setTitle('❌ Insufficient Funds')
                        .setColor(0xFF0000)
                        .setDescription([
                            `You cannot afford to unlock **${newBiome.emoji} ${newBiome.name}**`,
                            ``,
                            `**Unlock Cost:** ${cost.display}`,
                            `${cost.coins > 0 ? `💰 ${formatNumber(cost.coins)} Coins` : ''}`,
                            `${cost.gems > 0 ? `💎 ${formatNumber(cost.gems)} Gems` : ''}`,
                            ``,
                            `**Your Balance:**`,
                            `💰 ${formatNumber(coins)} Coins`,
                            `💎 ${formatNumber(gems)} Gems`
                        ].filter(Boolean).join('\n'))
                    ],
                    ephemeral: true
                });
            }
            
            // Show purchase confirmation with buttons
            const confirmEmbed = new EmbedBuilder()
                .setTitle('🔓 Unlock Biome?')
                .setColor(newBiome.color)
                .setThumbnail(getBiomeImage(selectedBiomeId))
                .setDescription([
                    `**${newBiome.emoji} ${newBiome.name}**`,
                    `> ${newBiome.description}`,
                    ``,
                    `**Multipliers:** 💰 ${newBiome.multipliers.coins}x | 💎 ${newBiome.multipliers.gems}x`,
                    ``,
                    `\`\`\`diff`,
                    `- Unlock Cost`,
                    `\`\`\``,
                    `${cost.coins > 0 ? `💰 **${formatNumber(cost.coins)}** Coins` : ''}`,
                    `${cost.gems > 0 ? `💎 **${formatNumber(cost.gems)}** Gems` : ''}`,
                    ``,
                    `*This is a one-time purchase. Once unlocked, you can travel here anytime!*`
                ].filter(Boolean).join('\n'));
            
            const confirmRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`biome_confirm_unlock_${userId}_${selectedBiomeId}`)
                    .setLabel('✅ Confirm Purchase')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`biome_cancel_unlock_${userId}`)
                    .setLabel('❌ Cancel')
                    .setStyle(ButtonStyle.Danger)
            );
            
            return await interaction.update({
                embeds: [confirmEmbed],
                components: [confirmRow]
            });
        }
        
        // Check cooldown (only for already unlocked biomes)
        const cooldownStatus = await canChangeBiome(userId);
        if (!cooldownStatus.canChange) {
            const hours = Math.ceil(cooldownStatus.remainingMs / (60 * 60 * 1000));
            return await interaction.reply({
                embeds: [new EmbedBuilder()
                    .setTitle('⏰ Travel Cooldown')
                    .setColor(0xFFA500)
                    .setDescription(`You can travel to a new biome in **${hours}h**`)
                ],
                ephemeral: true
            });
        }
        
        // Set the new biome
        await setUserBiome(userId, selectedBiomeId);
        
        // Show success embed with biome image
        const successEmbed = createBiomeChangeEmbed(newBiome, oldBiome);
        successEmbed.setImage(getBiomeImage(selectedBiomeId));
        
        await interaction.update({
            embeds: [successEmbed],
            components: []
        });
        
    } catch (error) {
        console.error('Error changing biome:', error);
        await interaction.reply({
            content: '❌ Failed to change biome.',
            ephemeral: true
        });
    }
}

/**
 * Handle biome unlock confirmation
 */
async function handleBiomeUnlockConfirm(interaction, userId, biomeId) {
    try {
        const newBiome = getBiome(biomeId);
        if (!newBiome) {
            return await interaction.reply({ content: '❌ Invalid biome.', ephemeral: true });
        }
        
        const { coins, gems } = await getUserCurrency(userId);
        const cost = calculateUnlockCost(newBiome, coins, gems);
        const { canAfford } = canAffordBiome(newBiome, coins, gems);
        
        if (!canAfford) {
            return await interaction.reply({
                content: '❌ You no longer have enough funds!',
                ephemeral: true
            });
        }
        
        // Deduct cost
        await run(
            `UPDATE userData SET coins = coins - ?, gems = gems - ? WHERE odiscord = ?`,
            [cost.coins, cost.gems, userId]
        );
        
        // Unlock biome
        await unlockBiome(userId, biomeId);
        
        // Also set it as current biome
        await setUserBiome(userId, biomeId);
        
        const oldBiomeData = await getUserBiomeData(userId);
        
        const successEmbed = new EmbedBuilder()
            .setTitle('🎉 Biome Unlocked!')
            .setColor(newBiome.color)
            .setImage(getBiomeImage(biomeId))
            .setDescription([
                `You have unlocked and traveled to **${newBiome.emoji} ${newBiome.name}**!`,
                ``,
                `> ${newBiome.description}`,
                ``,
                `**New Multipliers:** 💰 ${newBiome.multipliers.coins}x | 💎 ${newBiome.multipliers.gems}x`,
                ``,
                `\`\`\`diff`,
                `- ${formatNumber(cost.coins)} Coins`,
                `- ${formatNumber(cost.gems)} Gems`,
                `\`\`\``
            ].join('\n'))
            .setFooter({ text: 'You can travel to any unlocked biome once per 24 hours' });
        
        await interaction.update({
            embeds: [successEmbed],
            components: []
        });
        
    } catch (error) {
        console.error('Error unlocking biome:', error);
        await interaction.reply({ content: '❌ Failed to unlock biome.', ephemeral: true });
    }
}

module.exports = {
    createBiomeSelectEmbed,
    createBiomeDetailEmbed,
    createBiomeChangeEmbed,
    getBiomeStatusText,
    handleBiomeChange,
    handleBiomeUnlockConfirm,
    getUserCurrency
};
