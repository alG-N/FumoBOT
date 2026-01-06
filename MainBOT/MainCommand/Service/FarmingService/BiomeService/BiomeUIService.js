const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { 
    getAllBiomes, 
    getAvailableBiomes, 
    getLockedBiomes, 
    getBiome,
    formatBiomeInfo,
    getBiomeRequirementText 
} = require('../../../Configuration/biomeConfig');
const { getUserBiomeData, setUserBiome, canChangeBiome } = require('./BiomeDatabaseService');

/**
 * Create biome selection embed
 * @param {string} userId 
 * @param {number} level 
 * @param {number} rebirthLevel 
 * @returns {Promise<{embed: EmbedBuilder, components: ActionRowBuilder[]}>}
 */
async function createBiomeSelectEmbed(userId, level, rebirthLevel = 0) {
    const biomeData = await getUserBiomeData(userId);
    const availableBiomes = getAvailableBiomes(level, rebirthLevel);
    const lockedBiomes = getLockedBiomes(level, rebirthLevel);
    
    const embed = new EmbedBuilder()
        .setTitle('🌍 Biome Selection')
        .setColor(biomeData.biome.color || 0x7CFC00)
        .setDescription(
            `**Current Biome:** ${biomeData.biome.emoji} ${biomeData.biome.name}\n` +
            `> ${biomeData.biome.description}\n\n` +
            `**Multipliers:** 💰 ${biomeData.biome.multipliers.coins}x | 💎 ${biomeData.biome.multipliers.gems}x`
        );
    
    // Add cooldown info
    if (!biomeData.canChange) {
        const hours = Math.ceil(biomeData.remainingMs / (60 * 60 * 1000));
        embed.addFields({
            name: '⏰ Cooldown',
            value: `You can change biome in **${hours} hour(s)**`,
            inline: false
        });
    }
    
    // Add available biomes
    if (availableBiomes.length > 0) {
        const availableText = availableBiomes
            .map(b => `${b.emoji} **${b.name}** - ${b.multipliers.coins}x 💰 / ${b.multipliers.gems}x 💎`)
            .join('\n');
        
        embed.addFields({
            name: `✅ Available Biomes (${availableBiomes.length})`,
            value: availableText || 'None',
            inline: false
        });
    }
    
    // Add locked biomes preview
    if (lockedBiomes.length > 0) {
        const lockedText = lockedBiomes
            .slice(0, 5) // Show max 5 locked biomes
            .map(b => `${b.emoji} ~~${b.name}~~ - *${getBiomeRequirementText(b)}*`)
            .join('\n');
        
        embed.addFields({
            name: `🔒 Locked Biomes (${lockedBiomes.length})`,
            value: lockedText + (lockedBiomes.length > 5 ? `\n*...and ${lockedBiomes.length - 5} more*` : ''),
            inline: false
        });
    }
    
    // Create select menu for available biomes
    const components = [];
    
    if (biomeData.canChange && availableBiomes.length > 1) {
        const selectOptions = availableBiomes.map(b => ({
            label: b.name,
            description: `${b.multipliers.coins}x coins, ${b.multipliers.gems}x gems`,
            value: b.id,
            emoji: b.emoji,
            default: b.id === biomeData.biomeId
        }));
        
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('biome_select')
            .setPlaceholder('Select a biome...')
            .addOptions(selectOptions);
        
        components.push(new ActionRowBuilder().addComponents(selectMenu));
    }
    
    // Add info button
    const buttonRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('biome_info')
            .setLabel('View Details')
            .setEmoji('📋')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('biome_refresh')
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
 */
async function handleBiomeChange(interaction, userId) {
    if (!interaction.isStringSelectMenu()) {
        return;
    }
    
    const selectedBiomeId = interaction.values[0];
    
    try {
        // Check cooldown
        const cooldownStatus = await canChangeBiome(userId);
        if (!cooldownStatus.canChange) {
            const hours = Math.ceil(cooldownStatus.remainingMs / (60 * 60 * 1000));
            return await interaction.reply({
                embeds: [{
                    title: '⏰ Cooldown Active',
                    description: `You can change biome again in **${hours} hour(s)**`,
                    color: 0xFFA500
                }],
                ephemeral: true
            });
        }
        
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
        
        // Set the new biome
        await setUserBiome(userId, selectedBiomeId);
        
        // Show success embed
        const successEmbed = createBiomeChangeEmbed(newBiome, oldBiome);
        
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

module.exports = {
    createBiomeSelectEmbed,
    createBiomeDetailEmbed,
    createBiomeChangeEmbed,
    getBiomeStatusText,
    handleBiomeChange
};
