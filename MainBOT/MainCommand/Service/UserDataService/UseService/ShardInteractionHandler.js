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
 * Central handler for all ShinyShard and alGShard interactions
 */
async function handleShardInteractions(interaction) {
    if (!interaction.isStringSelectMenu() && !interaction.isButton()) {
        return false;
    }

    const customId = interaction.customId;

    // Verify ownership
    const userId = interaction.user.id;
    if (!customId.includes(userId)) {
        await interaction.reply({
            content: "❌ You can't use someone else's interaction.",
            ephemeral: true
        });
        return true;
    }

    try {
        // ShinyShard handlers
        if (customId.startsWith('shiny_rarity_select_')) {
            await handleShinyShardRaritySelection(interaction);
            return true;
        }
        
        if (customId.startsWith('shiny_fumo_select_')) {
            await handleShinyShardFumoSelection(interaction);
            return true;
        }
        
        if (customId.startsWith('shiny_confirm_')) {
            await handleShinyShardConfirmation(interaction);
            return true;
        }
        
        if (customId.startsWith('shiny_cancel_')) {
            await handleShinyShardCancellation(interaction);
            return true;
        }
        
        if (customId.startsWith('shiny_back_')) {
            await handleShinyShardBack(interaction);
            return true;
        }

        // alGShard handlers
        if (customId.startsWith('alg_rarity_select_')) {
            await handleAlGShardRaritySelection(interaction);
            return true;
        }
        
        if (customId.startsWith('alg_fumo_select_')) {
            await handleAlGShardFumoSelection(interaction);
            return true;
        }
        
        if (customId.startsWith('alg_confirm_')) {
            await handleAlGShardConfirmation(interaction);
            return true;
        }
        
        if (customId.startsWith('alg_cancel_')) {
            await handleAlGShardCancellation(interaction);
            return true;
        }
        
        if (customId.startsWith('alg_back_')) {
            await handleAlGShardBack(interaction);
            return true;
        }

    } catch (error) {
        console.error('[SHARD_INTERACTION] Error:', error);
        
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: '❌ An error occurred while processing your interaction.',
                ephemeral: true
            }).catch(() => {});
        }
    }

    return false;
}

/**
 * Initialize the shard interaction handler with the Discord client
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