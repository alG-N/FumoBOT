/**
 * Other Place Handler Service
 * 
 * Handles interaction logic for the Other Place feature
 */

const db = require('../../../Core/Database/dbSetting');
const { getOtherPlaceSlots, getOtherPlaceEfficiency } = require('./OtherPlaceConfig');
const {
    getOtherPlaceFumos,
    sendFumoToOtherPlace,
    retrieveFumoFromOtherPlace,
    collectOtherPlaceIncome,
    getOtherPlaceFumoCount,
    initializeTable
} = require('./OtherPlaceDatabaseService');
const {
    createOtherPlaceEmbed,
    createOtherPlaceButtons,
    createSendFumoEmbed,
    createFumoSelectMenu,
    createCollectionEmbed,
    createErrorEmbed
} = require('./OtherPlaceUIService');

// Initialize table on load
initializeTable().catch(console.error);

/**
 * Handle opening the Other Place UI
 * @param {Interaction} interaction 
 * @param {string} userId 
 * @param {number} rebirthLevel 
 */
async function handleOtherPlaceOpen(interaction, userId, rebirthLevel) {
    try {
        const slots = getOtherPlaceSlots(rebirthLevel);
        const usedSlots = await getOtherPlaceFumoCount(userId);
        const fumos = await getOtherPlaceFumos(userId);
        
        const embed = await createOtherPlaceEmbed(userId, rebirthLevel);
        const buttons = createOtherPlaceButtons(userId, usedSlots, slots, fumos.length > 0);
        
        await interaction.update({
            embeds: [embed],
            components: [buttons]
        });
    } catch (error) {
        console.error('[OtherPlace] Error opening:', error);
        await interaction.reply({
            embeds: [createErrorEmbed('Failed to load Other Place. Please try again.')],
            ephemeral: true
        });
    }
}

/**
 * Handle sending a fumo to Other Place
 * @param {Interaction} interaction 
 * @param {string} userId 
 * @param {number} rebirthLevel 
 */
async function handleSendFumo(interaction, userId, rebirthLevel) {
    try {
        const slots = getOtherPlaceSlots(rebirthLevel);
        const usedSlots = await getOtherPlaceFumoCount(userId);
        
        if (usedSlots >= slots) {
            return interaction.reply({
                embeds: [createErrorEmbed(`You've reached your limit of ${slots} fumos. Retrieve some first!`)],
                ephemeral: true
            });
        }
        
        // Get available fumos from inventory (not items, only fumos)
        const availableFumos = await new Promise((resolve, reject) => {
            db.all(
                `SELECT itemName as fumoName, quantity FROM userInventory 
                 WHERE userId = ? AND quantity > 0 
                 AND (itemName LIKE '%(C)%' OR itemName LIKE '%(U)%' OR itemName LIKE '%(R)%' 
                      OR itemName LIKE '%(E)%' OR itemName LIKE '%(L)%' OR itemName LIKE '%(M)%' 
                      OR itemName LIKE '%(?)%' OR itemName LIKE '%(T)%')
                 ORDER BY itemName`,
                [userId],
                (err, rows) => err ? reject(err) : resolve(rows || [])
            );
        });
        
        if (availableFumos.length === 0) {
            return interaction.reply({
                embeds: [createErrorEmbed('You don\'t have any fumos to send!')],
                ephemeral: true
            });
        }
        
        const embed = createSendFumoEmbed(availableFumos);
        const selectMenu = createFumoSelectMenu(userId, availableFumos, 'send');
        
        await interaction.reply({
            embeds: [embed],
            components: selectMenu ? [selectMenu] : [],
            ephemeral: true
        });
    } catch (error) {
        console.error('[OtherPlace] Error showing send menu:', error);
        await interaction.reply({
            embeds: [createErrorEmbed('Failed to load fumo list. Please try again.')],
            ephemeral: true
        });
    }
}

/**
 * Handle retrieving a fumo from Other Place
 * @param {Interaction} interaction 
 * @param {string} userId 
 */
async function handleRetrieveFumo(interaction, userId) {
    try {
        const fumos = await getOtherPlaceFumos(userId);
        
        if (fumos.length === 0) {
            return interaction.reply({
                embeds: [createErrorEmbed('You don\'t have any fumos in the Other Place!')],
                ephemeral: true
            });
        }
        
        const selectMenu = createFumoSelectMenu(userId, fumos, 'retrieve');
        
        await interaction.reply({
            content: '📥 **Select a fumo to retrieve:**',
            components: selectMenu ? [selectMenu] : [],
            ephemeral: true
        });
    } catch (error) {
        console.error('[OtherPlace] Error showing retrieve menu:', error);
        await interaction.reply({
            embeds: [createErrorEmbed('Failed to load Other Place fumos. Please try again.')],
            ephemeral: true
        });
    }
}

/**
 * Handle collecting income from Other Place
 * @param {Interaction} interaction 
 * @param {string} userId 
 * @param {number} rebirthLevel 
 */
async function handleCollectIncome(interaction, userId, rebirthLevel) {
    try {
        const efficiency = getOtherPlaceEfficiency(rebirthLevel);
        const { coins, gems } = await collectOtherPlaceIncome(userId, efficiency);
        
        if (coins === 0 && gems === 0) {
            return interaction.reply({
                embeds: [createErrorEmbed('No income to collect yet. Let your fumos earn for a while!')],
                ephemeral: true
            });
        }
        
        await interaction.reply({
            embeds: [createCollectionEmbed(coins, gems)],
            ephemeral: false
        });
    } catch (error) {
        console.error('[OtherPlace] Error collecting income:', error);
        await interaction.reply({
            embeds: [createErrorEmbed('Failed to collect income. Please try again.')],
            ephemeral: true
        });
    }
}

/**
 * Handle fumo selection from menu
 * @param {Interaction} interaction 
 * @param {string} userId 
 * @param {string} action - 'send' or 'retrieve'
 * @param {string} fumoName 
 * @param {number} rebirthLevel 
 */
async function handleFumoSelect(interaction, userId, action, fumoName, rebirthLevel) {
    try {
        if (action === 'send') {
            await sendFumoToOtherPlace(userId, fumoName, 1);
            await interaction.update({
                content: `✅ **${fumoName}** has been sent to the Other Place!`,
                components: [],
                embeds: []
            });
        } else if (action === 'retrieve') {
            await retrieveFumoFromOtherPlace(userId, fumoName, 1);
            await interaction.update({
                content: `✅ **${fumoName}** has been retrieved from the Other Place!`,
                components: [],
                embeds: []
            });
        }
    } catch (error) {
        console.error('[OtherPlace] Error handling selection:', error);
        await interaction.reply({
            embeds: [createErrorEmbed(error.message || 'An error occurred. Please try again.')],
            ephemeral: true
        });
    }
}

module.exports = {
    handleOtherPlaceOpen,
    handleSendFumo,
    handleRetrieveFumo,
    handleCollectIncome,
    handleFumoSelect
};
