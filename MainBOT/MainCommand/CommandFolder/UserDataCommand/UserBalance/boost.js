const { checkRestrictions } = require('../../../Middleware/restrictions');
const { checkButtonOwnership } = require('../../../Middleware/buttonOwnership');
const { getActiveBoosts } = require('../../../Service/UserDataService/BoostService/BoostQueryService');
const { createBoostEmbed, createBoostButtons } = require('../../../Service/UserDataService/BoostService/BoostUIService');

module.exports = (client) => {
    // Message command handler
    client.on("messageCreate", async (message) => {
        if (message.author.bot) return;

        const prefixMatch = message.content.match(/^\.b(?:oost|st)?$/i);
        if (!prefixMatch) return;

        const userId = message.author.id;

        const restriction = checkRestrictions(userId);
        if (restriction.blocked) {
            return message.reply({ embeds: [restriction.embed] });
        }

        try {
            const boostData = await getActiveBoosts(userId);
            const embed = createBoostEmbed(boostData, null);
            const buttons = createBoostButtons(userId, null);

            const sentMessage = await message.reply({ 
                embeds: [embed], 
                components: buttons 
            });

            // Set up collector for button interactions
            const collector = sentMessage.createMessageComponentCollector({ 
                time: 120000 // 2 minutes
            });

            collector.on('collect', async (interaction) => {
                if (!checkButtonOwnership(interaction)) {
                    return interaction.reply({ 
                        content: '❌ This is not your boost panel!',
                        ephemeral: true 
                    });
                }

                const [, action] = interaction.customId.split('_');
                
                try {
                    // Refresh boost data
                    const newBoostData = await getActiveBoosts(userId);
                    
                    let category = null;
                    if (action === 'overview') {
                        category = null;
                    } else if (action === 'refresh') {
                        category = null;
                    } else if (['coin', 'gem', 'luck', 'special', 'sanae', 'cooldown', 'yuyuko', 'debuff'].includes(action)) {
                        category = action;
                    }

                    const newEmbed = createBoostEmbed(newBoostData, category);
                    const newButtons = createBoostButtons(userId, category);

                    await interaction.update({ 
                        embeds: [newEmbed], 
                        components: newButtons 
                    });
                } catch (err) {
                    console.error('[BOOST] Button error:', err);
                    await interaction.reply({ 
                        content: '❌ An error occurred. Please try again.',
                        ephemeral: true 
                    });
                }
            });

            collector.on('end', async () => {
                try {
                    await sentMessage.edit({ components: [] });
                } catch {}
            });

        } catch (error) {
            console.error('[BOOST] Error:', error);
            await message.reply("❌ An error occurred while fetching your boosts. Please try again later.");
        }
    });
};