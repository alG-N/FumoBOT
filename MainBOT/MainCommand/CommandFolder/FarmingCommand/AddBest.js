const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, Colors } = require('discord.js');
const { checkRestrictions } = require('../../Middleware/restrictions');
const { checkButtonOwnership } = require('../../Middleware/buttonOwnership');
const { optimizeFarm } = require('../../Service/FarmingService/FarmingActionService');
const { createSuccessEmbed, createErrorEmbed, createWarningEmbed } = require('../../Service/FarmingService/FarmingUIService');
const { getFarmLimit, getUserFarmingFumos } = require('../../Service/FarmingService/FarmingDatabaseService');
const { calculateFarmLimit } = require('../../Service/FarmingService/FarmingCalculationService');
const { logToDiscord, LogLevel } = require('../../Core/logger');
const { get } = require('../../Core/database');

module.exports = async (client) => {
    client.on('messageCreate', async (message) => {
        if (message.author.bot) return;
        if (!message.content.startsWith('.addbest') && !message.content.startsWith('.ab')) return;

        const restriction = checkRestrictions(message.author.id);
        if (restriction.blocked) {
            return message.reply({ embeds: [restriction.embed] });
        }

        const userId = message.author.id;

        try {
            // Get current farm status
            const fragmentUses = await getFarmLimit(userId);
            const upgradesRow = await get(`SELECT limitBreaks FROM userUpgrades WHERE userId = ?`, [userId]);
            const limitBreaks = upgradesRow?.limitBreaks || 0;
            const farmLimit = calculateFarmLimit(fragmentUses) + limitBreaks;
            
            const farmingFumos = await getUserFarmingFumos(userId);
            const currentFarmCount = farmingFumos.reduce((sum, f) => sum + (parseInt(f.quantity) || 1), 0);

            // Create confirmation embed
            const confirmEmbed = new EmbedBuilder()
                .setTitle('🌾 Optimize Farm - Confirmation')
                .setColor(Colors.Yellow)
                .setDescription(
                    '**⚠️ Warning:** This will replace your entire farm with the best earning Fumos from your inventory.\n\n' +
                    '**Current Farm Status:**\n' +
                    `• Farming: ${currentFarmCount} / ${farmLimit} slots\n` +
                    `• Unique Fumos: ${farmingFumos.length}\n\n` +
                    '**What will happen:**\n' +
                    '• All current farming Fumos will be removed\n' +
                    '• System will select the highest earning Fumos\n' +
                    '• Maximum quantities will be added up to your farm limit\n' +
                    '• Prioritizes total income (coins + gems)\n\n' +
                    '**Are you sure you want to proceed?**'
                )
                .setFooter({ text: 'This action cannot be undone!' })
                .setTimestamp();

            const confirmButtons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`addbest_confirm_${userId}`)
                        .setLabel('✅ Yes, Optimize')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId(`addbest_cancel_${userId}`)
                        .setLabel('❌ Cancel')
                        .setStyle(ButtonStyle.Danger)
                );

            const msg = await message.reply({
                embeds: [confirmEmbed],
                components: [confirmButtons]
            });

            // Set timeout to disable buttons after 60 seconds
            setTimeout(() => {
                msg.edit({ components: [] }).catch(() => {});
            }, 60000);

        } catch (error) {
            console.error('Error in .addbest:', error);
            await logToDiscord(client, `Error in .addbest for ${message.author.tag}`, error, LogLevel.ERROR);

            return message.reply({
                embeds: [createErrorEmbed('⚠️ Something went wrong.')]
            });
        }
    });

    // Handle confirmation button
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isButton()) return;
        if (!interaction.customId.startsWith('addbest_confirm_')) return;

        if (!await checkButtonOwnership(interaction)) return;

        await interaction.deferUpdate();

        const userId = interaction.user.id;

        try {
            // Show processing embed
            const processingEmbed = new EmbedBuilder()
                .setTitle('🌾 Optimizing Farm...')
                .setColor(Colors.Blue)
                .setDescription('Please wait while we optimize your farm...')
                .setTimestamp();

            await interaction.editReply({
                embeds: [processingEmbed],
                components: []
            });

            // Perform optimization
            const result = await optimizeFarm(userId);

            if (!result.success) {
                return interaction.editReply({
                    embeds: [createErrorEmbed('Failed to optimize your farm. Please try again.')]
                });
            }

            // Get the newly optimized farm to show what was added
            const newFarmingFumos = await getUserFarmingFumos(userId);

            await logToDiscord(
                client,
                `User ${interaction.user.tag} optimized farm: ${result.count} total Fumos (${result.uniqueFumos} unique types)`,
                null,
                LogLevel.ACTIVITY
            );

            // Get farm limit for display
            const fragmentUses = await getFarmLimit(userId);
            const upgradesRow = await get(`SELECT limitBreaks FROM userUpgrades WHERE userId = ?`, [userId]);
            const limitBreaks = upgradesRow?.limitBreaks || 0;
            const farmLimit = calculateFarmLimit(fragmentUses) + limitBreaks;

            // Group fumos by rarity for better display
            const { groupByRarity, getRarityFromName } = require('../../Service/FarmingService/FarmingCalculationService');
            const { RARITY_PRIORITY } = require('../../Configuration/rarity');
            
            const grouped = {};
            newFarmingFumos.forEach(fumo => {
                const rarity = getRarityFromName(fumo.fumoName);
                if (!grouped[rarity]) {
                    grouped[rarity] = [];
                }
                grouped[rarity].push(fumo);
            });

            // Format fumo list by rarity
            let fumoListText = '';
            for (const rarity of RARITY_PRIORITY) {
                if (!grouped[rarity]) continue;
                
                const fumoNames = grouped[rarity].map(f => {
                    const baseName = f.fumoName
                        .replace(/\(.*?\)/g, '')
                        .replace(/\[✨SHINY\]/g, '')
                        .replace(/\[🌟alG\]/g, '')
                        .trim();
                    
                    const traits = [];
                    if (f.fumoName.includes('✨SHINY')) traits.push('✨');
                    if (f.fumoName.includes('🌟alG')) traits.push('🌟');
                    const traitStr = traits.length > 0 ? `[${traits.join('')}]` : '';
                    
                    const quantity = f.quantity > 1 ? ` x${f.quantity}` : '';
                    return `${baseName}${traitStr}${quantity}`;
                }).join(', ');
                
                fumoListText += `**${rarity}:** ${fumoNames}\n`;
            }

            // Create success embed with details
            const successEmbed = new EmbedBuilder()
                .setTitle('✅ Farm Optimization Complete!')
                .setColor(Colors.Green)
                .setDescription(
                    '**Your farm has been optimized successfully!**\n\n' +
                    '**Results:**\n' +
                    `• **Total Fumos Farming:** ${result.count} / ${farmLimit}\n` +
                    `• **Unique Types:** ${result.uniqueFumos}\n` +
                    `• **Status:** ${result.count === farmLimit ? 'Farm is at maximum capacity! 🎉' : 'Farm optimized with available Fumos'}\n\n` +
                    '**What happened:**\n' +
                    '• Selected highest earning Fumos from inventory\n' +
                    '• Maximized quantities based on availability\n' +
                    '• Prioritized total income (coins + gems)'
                )
                .addFields({
                    name: '🌾 Fumos Now Farming',
                    value: fumoListText || 'None',
                    inline: false
                })
                .addFields({
                    name: '💡 Next Steps',
                    value: 'Use `.farmcheck` to see detailed farm status and earnings!',
                    inline: false
                })
                .setFooter({ text: 'Your Fumos are now working at peak efficiency!' })
                .setTimestamp();

            await interaction.editReply({
                embeds: [successEmbed]
            });

        } catch (error) {
            console.error('Error confirming farm optimization:', error);
            await logToDiscord(client, `Error in farm optimization for ${interaction.user.tag}`, error, LogLevel.ERROR);

            await interaction.editReply({
                embeds: [createErrorEmbed('⚠️ An error occurred during optimization.')]
            }).catch(() => {});
        }
    });

    // Handle cancel button
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isButton()) return;
        if (!interaction.customId.startsWith('addbest_cancel_')) return;

        if (!await checkButtonOwnership(interaction)) return;

        await interaction.update({
            embeds: [createWarningEmbed('Farm optimization cancelled.')],
            components: []
        });
    });
};