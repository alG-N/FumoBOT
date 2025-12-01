const { checkButtonOwnership, buildSecureCustomId } = require('../../../Middleware/buttonOwnership');
const { 
    handleShinyShardRaritySelection, 
    handleShinyShardFumoSelection, 
    handleShinyShardConfirmation, 
    handleShinyShardCancellation,
    handleShinyShardBack
} = require('./ItemUseHandler/ShinyShardHandler');

const { 
    handleAlGShardRaritySelection, 
    handleAlGShardFumoSelection, 
    handleAlGShardConfirmation, 
    handleAlGShardCancellation,
    handleAlGShardBack
} = require('./ItemUseHandler/alGShardHandler');

/**
 * Map of interaction handlers
 */
const INTERACTION_HANDLERS = {
    // ShinyShard handlers
    'shiny_rarity_select': handleShinyShardRaritySelection,
    'shiny_fumo_select': handleShinyShardFumoSelection,
    'shiny_confirm': handleShinyShardConfirmation,
    'shiny_cancel': handleShinyShardCancellation,
    'shiny_back': handleShinyShardBack,
    
    // alGShard handlers
    'alg_rarity_select': handleAlGShardRaritySelection,
    'alg_fumo_select': handleAlGShardFumoSelection,
    'alg_confirm': handleAlGShardConfirmation,
    'alg_cancel': handleAlGShardCancellation,
    'alg_back': handleAlGShardBack
};

/**
 * Extract action prefix from customId
 */
function getActionPrefix(customId) {
    // Extract everything before the userId
    // Example: "shiny_rarity_select_123456" -> "shiny_rarity_select"
    const parts = customId.split('_');
    
    // Find where the userId starts (17-19 digit number)
    let actionParts = [];
    for (const part of parts) {
        if (/^\d{17,19}$/.test(part)) {
            break;
        }
        actionParts.push(part);
    }
    
    return actionParts.join('_');
}

/**
 * Check if this is a shard-related interaction
 */
function isShardInteraction(customId) {
    return customId.startsWith('shiny_') || customId.startsWith('alg_');
}

/**
 * Central handler for all ShinyShard and alGShard interactions
 */
async function handleShardInteractions(interaction) {
    if (!interaction.isStringSelectMenu() && !interaction.isButton()) {
        return false;
    }

    const customId = interaction.customId;

    // Check if this is a shard interaction
    if (!isShardInteraction(customId)) {
        return false;
    }

    // Verify ownership using middleware
    const isOwner = await checkButtonOwnership(interaction, null, 
        "❌ You can't use someone else's shard selection.", true);
    
    if (!isOwner) {
        return true; // Handled (with error)
    }

    // Get the action prefix
    const actionPrefix = getActionPrefix(customId);
    
    // Get the handler
    const handler = INTERACTION_HANDLERS[actionPrefix];
    
    if (!handler) {
        console.warn(`[SHARD_INTERACTION] No handler found for: ${actionPrefix}`);
        return false;
    }

    try {
        await handler(interaction);
        return true;
    } catch (error) {
        console.error('[SHARD_INTERACTION] Error:', error);
        
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: '❌ An error occurred while processing your interaction.',
                ephemeral: true
            }).catch(() => {});
        }
        
        return true; // Still handled, just with an error
    }
}

/**
 * Initialize the shard interaction handler with the Discord client
 * This should be called from the main bot file
 */
function initializeShardHandler(discordClient) {
    discordClient.on('interactionCreate', async (interaction) => {
        try {
            await handleShardInteractions(interaction);
        } catch (error) {
            console.error('[SHARD_INTERACTION_SETUP] Unexpected error:', error);
        }
    });

    console.log('✅ Shard interaction handler initialized');
}

// Export both the initialization function and the handler
module.exports = initializeShardHandler;
module.exports.handleShardInteractions = handleShardInteractions;
module.exports.isShardInteraction = isShardInteraction;