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

const INTERACTION_HANDLERS = {
    'shiny_rarity_select': handleShinyShardRaritySelection,
    'shiny_fumo_select': handleShinyShardFumoSelection,
    'shiny_confirm': handleShinyShardConfirmation,
    'shiny_cancel': handleShinyShardCancellation,
    'shiny_back': handleShinyShardBack,
    
    'alg_rarity_select': handleAlGShardRaritySelection,
    'alg_fumo_select': handleAlGShardFumoSelection,
    'alg_confirm': handleAlGShardConfirmation,
    'alg_cancel': handleAlGShardCancellation,
    'alg_back': handleAlGShardBack
};

function getActionPrefix(customId) {
    const parts = customId.split('_');
    
    let actionParts = [];
    for (const part of parts) {
        if (/^\d{17,19}$/.test(part)) {
            break;
        }
        actionParts.push(part);
    }
    
    return actionParts.join('_');
}

function isShardInteraction(customId) {
    return customId.startsWith('shiny_') || customId.startsWith('alg_');
}

async function handleShardInteractions(interaction) {
    if (!interaction.isStringSelectMenu() && !interaction.isButton()) {
        return false;
    }

    const customId = interaction.customId;

    if (!isShardInteraction(customId)) {
        return false;
    }

    const isOwner = await checkButtonOwnership(interaction, null, 
        "❌ You can't use someone else's shard selection.", true);
    
    if (!isOwner) {
        return true;
    }

    const actionPrefix = getActionPrefix(customId);
    
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
        
        return true;
    }
}

function initializeShardHandler(discordClient) {
    discordClient.on('interactionCreate', async (interaction) => {
        try {
            await handleShardInteractions(interaction);
        } catch (error) {
            console.error('[SHARD_INTERACTION_SETUP] Unexpected error:', error);
        }
    });
}

module.exports = initializeShardHandler;
module.exports.handleShardInteractions = handleShardInteractions;
module.exports.isShardInteraction = isShardInteraction;