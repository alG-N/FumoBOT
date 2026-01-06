/**
 * Other Place UI Service
 * 
 * Handles UI elements for the Other Place feature
 */

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const { formatNumber } = require('../../../Ultility/formatting');
const { getStatsByRarity } = require('../../../Ultility/characterStats');
const { getOtherPlaceSlots, getOtherPlaceEfficiency, getOtherPlaceTier } = require('./OtherPlaceConfig');
const { getOtherPlaceFumos, getPendingIncome, getOtherPlaceFumoCount } = require('./OtherPlaceDatabaseService');

/**
 * Create the main Other Place embed
 * @param {string} userId 
 * @param {number} rebirthLevel 
 * @returns {Promise<EmbedBuilder>}
 */
async function createOtherPlaceEmbed(userId, rebirthLevel) {
    const slots = getOtherPlaceSlots(rebirthLevel);
    const efficiency = getOtherPlaceEfficiency(rebirthLevel);
    const tier = getOtherPlaceTier(rebirthLevel);
    
    const fumos = await getOtherPlaceFumos(userId);
    const usedSlots = fumos.reduce((sum, f) => sum + f.quantity, 0);
    const pendingIncome = await getPendingIncome(userId, efficiency);
    
    const embed = new EmbedBuilder()
        .setTitle(`${tier}`)
        .setDescription([
            `> *Send fumos to an alternate dimension to earn passive income*`,
            ``,
            `**📊 Status**`,
            `• Slots: **${usedSlots}/${slots}** used`,
            `• Efficiency: **${Math.round(efficiency * 100)}%** of normal income`,
            `• ♻️ Rebirth Level: **${rebirthLevel}**`,
            ``,
            `**💰 Pending Income**`,
            `• 💰 Coins: **${formatNumber(pendingIncome.coins)}**`,
            `• 💎 Gems: **${formatNumber(pendingIncome.gems)}**`
        ].join('\n'))
        .setColor(0x9B59B6)
        .setFooter({ text: 'Fumos earn 30-75% of normal income • Higher rebirth = more slots & efficiency' });
    
    // Show current fumos
    if (fumos.length > 0) {
        const fumoList = fumos.slice(0, 10).map(f => {
            const stats = getStatsByRarity(f.fumoName);
            const shortName = f.fumoName.length > 25 ? f.fumoName.substring(0, 22) + '...' : f.fumoName;
            return `• ${shortName} (x${f.quantity}) - ${formatNumber(Math.floor(stats.coinsPerMin * efficiency))}/min`;
        }).join('\n');
        
        embed.addFields({
            name: `🌌 Fumos in Other Place (${fumos.length} types)`,
            value: fumoList + (fumos.length > 10 ? `\n*...and ${fumos.length - 10} more*` : ''),
            inline: false
        });
    }
    
    return embed;
}

/**
 * Create action buttons for Other Place
 * @param {string} userId 
 * @param {number} usedSlots 
 * @param {number} maxSlots 
 * @param {boolean} hasFumos 
 * @returns {ActionRowBuilder}
 */
function createOtherPlaceButtons(userId, usedSlots, maxSlots, hasFumos) {
    const canSend = usedSlots < maxSlots;
    
    return new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`otherplace_send_${userId}`)
                .setLabel('📤 Send Fumo')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(!canSend),
            new ButtonBuilder()
                .setCustomId(`otherplace_retrieve_${userId}`)
                .setLabel('📥 Retrieve')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(!hasFumos),
            new ButtonBuilder()
                .setCustomId(`otherplace_collect_${userId}`)
                .setLabel('💰 Collect Income')
                .setStyle(ButtonStyle.Success)
                .setDisabled(!hasFumos),
            new ButtonBuilder()
                .setCustomId(`otherplace_back_${userId}`)
                .setLabel('🔙 Back')
                .setStyle(ButtonStyle.Secondary)
        );
}

/**
 * Create fumo selection embed for sending to Other Place
 * @param {string} userId 
 * @param {Array} availableFumos 
 * @returns {EmbedBuilder}
 */
function createSendFumoEmbed(availableFumos) {
    return new EmbedBuilder()
        .setTitle('📤 Send Fumo to Other Place')
        .setDescription([
            'Select a fumo from your inventory to send to the Other Place.',
            '',
            `*You have **${availableFumos.length}** fumo types available*`
        ].join('\n'))
        .setColor(0x9B59B6);
}

/**
 * Create fumo selection menu
 * @param {string} userId 
 * @param {Array} fumos 
 * @param {string} action - 'send' or 'retrieve'
 * @returns {ActionRowBuilder|null}
 */
function createFumoSelectMenu(userId, fumos, action) {
    if (fumos.length === 0) return null;
    
    const options = fumos.slice(0, 25).map(f => {
        const shortName = f.fumoName.length > 50 ? f.fumoName.substring(0, 47) + '...' : f.fumoName;
        return {
            label: shortName,
            description: `Quantity: ${f.quantity}`,
            value: `${action}_${f.fumoName}`
        };
    });
    
    return new ActionRowBuilder()
        .addComponents(
            new StringSelectMenuBuilder()
                .setCustomId(`otherplace_select_${action}_${userId}`)
                .setPlaceholder(`Select a fumo to ${action}`)
                .addOptions(options)
        );
}

/**
 * Create collection success embed
 * @param {number} coins 
 * @param {number} gems 
 * @returns {EmbedBuilder}
 */
function createCollectionEmbed(coins, gems) {
    return new EmbedBuilder()
        .setTitle('💰 Other Place Income Collected!')
        .setDescription([
            '**Earnings:**',
            `• 💰 Coins: **+${formatNumber(coins)}**`,
            `• 💎 Gems: **+${formatNumber(gems)}**`,
            '',
            '*Your fumos continue earning. Check back later!*'
        ].join('\n'))
        .setColor(0x2ECC71);
}

/**
 * Create error embed
 * @param {string} message 
 * @returns {EmbedBuilder}
 */
function createErrorEmbed(message) {
    return new EmbedBuilder()
        .setTitle('❌ Error')
        .setDescription(message)
        .setColor(0xFF6B6B);
}

module.exports = {
    createOtherPlaceEmbed,
    createOtherPlaceButtons,
    createSendFumoEmbed,
    createFumoSelectMenu,
    createCollectionEmbed,
    createErrorEmbed
};
