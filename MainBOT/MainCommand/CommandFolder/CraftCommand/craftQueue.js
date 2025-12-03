const { checkRestrictions } = require('../../Middleware/restrictions');
const { getQueueItems, claimQueuedCraft, claimAllReady } = require('../../Service/CraftService/CraftProcessService');
const { createQueueEmbed } = require('../../Service/CraftService/CraftUIService');
const { parseCustomId } = require('../../Middleware/buttonOwnership');

module.exports = (client) => {
    client.on('messageCreate', async (message) => {
        try {
            if (message.author.bot) return;
            if (message.content !== '.craftQueue' && message.content !== '.cq') return;

            const restriction = checkRestrictions(message.author.id);
            if (restriction.blocked) {
                return message.reply({ embeds: [restriction.embed] });
            }

            const userId = message.author.id;
            const queueItems = await getQueueItems(userId);
            const queueData = createQueueEmbed(queueItems, { userId });

            const sent = await message.reply({ 
                embeds: [queueData.embed], 
                components: queueData.buttons 
            });

            // Auto-refresh collector
            const collector = sent.createMessageComponentCollector({
                filter: i => i.user.id === userId,
                time: 300000 // 5 minutes
            });

            collector.on('collect', async interaction => {
                const { action, additionalData } = parseCustomId(interaction.customId);

                if (action === 'craft_claim') {
                    const queueId = additionalData?.id;
                    if (!queueId) return;

                    try {
                        const claimed = await claimQueuedCraft(queueId, userId);
                        
                        // Refresh queue
                        const updatedQueue = await getQueueItems(userId);
                        const updatedData = createQueueEmbed(updatedQueue, { userId });
                        
                        await interaction.update({ 
                            embeds: [updatedData.embed], 
                            components: updatedData.buttons 
                        });
                        
                        await interaction.followUp({ 
                            content: `✅ Claimed **${claimed.amount}x ${claimed.itemName}**!`, 
                            ephemeral: true 
                        });
                    } catch (error) {
                        await interaction.reply({ 
                            content: '❌ Failed to claim. Item may not be ready yet.', 
                            ephemeral: true 
                        });
                    }
                    return;
                }

                if (action === 'craft_queue_refresh') {
                    const updatedQueue = await getQueueItems(userId);
                    const updatedData = createQueueEmbed(updatedQueue, { userId });
                    await interaction.update({ 
                        embeds: [updatedData.embed], 
                        components: updatedData.buttons 
                    });
                    return;
                }

                if (action === 'craft_back') {
                    collector.stop();
                    await interaction.update({ 
                        content: 'Queue view closed. Use `.craftQueue` or `.cq` to check again!', 
                        embeds: [], 
                        components: [] 
                    });
                    return;
                }
            });

            collector.on('end', () => {
                sent.edit({ components: [] }).catch(() => {});
            });

        } catch (err) {
            console.error('[craftQueue] Error:', err);
            message.reply('❌ An error occurred while fetching your crafting queue.');
        }
    });
};